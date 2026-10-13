import { useRef } from 'react';
import { expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConversationRuler } from './ConversationRuler';
import { AttachmentList } from './AttachmentControls';
import { MindMap } from './MindMap';
import { exampleSession, message } from './core';
const media=vi.hoisted(()=>({read:vi.fn(),save:vi.fn(async()=>{})}));
vi.mock('./bridge',()=>({readAttachment:media.read,downloadAttachment:media.save}));

test('Ruler observes manual scrolling when its sibling scroll ref is initially null',async()=>{
  const questions=[message('user','First question'),message('user','Second question')];
  function InitialConversation(){const scroll=useRef<HTMLDivElement>(null);return <><ConversationRuler messages={questions} scrollRef={scroll}/><div ref={scroll} data-testid="reading-scroll">{questions.map(q=><article key={q.id} data-message-id={q.id}>{q.text}</article>)}</div></>;}
  render(<InitialConversation/>);const scroll=screen.getByTestId('reading-scroll');Object.defineProperty(scroll,'clientHeight',{value:300});scroll.getBoundingClientRect=()=>({top:50} as DOMRect);
  [...scroll.children].forEach((el,i)=>{el.getBoundingClientRect=()=>({top:50+i*400-scroll.scrollTop} as DOMRect);});
  fireEvent.scroll(scroll);await waitFor(()=>expect(screen.getByRole('button',{name:'Round 1 · First question'}).getAttribute('aria-current')).toBe('step'));
  scroll.scrollTop=350;fireEvent.scroll(scroll);await waitFor(()=>expect(screen.getByRole('button',{name:'Round 2 · Second question'}).getAttribute('aria-current')).toBe('step'));
  scroll.scrollTop=0;fireEvent.scroll(scroll);await waitFor(()=>expect(screen.getByRole('button',{name:'Round 1 · First question'}).getAttribute('aria-current')).toBe('step'));
});
test('Image attachments load local thumbnails, open a larger preview and keep original metadata',async()=>{
  const attachment={id:crypto.randomUUID(),name:'study.png',mime:'image/png',kind:'image' as const,size:3},before=structuredClone(attachment);media.read.mockResolvedValue({attachment,data:'YWJj'});media.save.mockClear();const user=userEvent.setup();render(<AttachmentList items={[attachment]} onNotice={()=>{}}/>);
  await waitFor(()=>expect(screen.getByRole('img',{name:'study.png'}).getAttribute('src')).toBe('data:image/png;base64,YWJj'));await user.click(screen.getByRole('button',{name:'Preview image · study.png'}));expect(screen.getByRole('dialog',{name:'Image preview'})).toBeDefined();expect(screen.getAllByRole('img',{name:'study.png'})).toHaveLength(2);
  await user.click(screen.getByRole('button',{name:'Save attachment'}));expect(media.save).toHaveBeenCalledWith(attachment);await user.keyboard('{Escape}');expect(screen.queryByRole('dialog',{name:'Image preview'})).toBeNull();expect(attachment).toEqual(before);
});
test('Map expansion replays on reopening rather than relying on a retained CSS animation',async()=>{
  const previous=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'animate'),animate=vi.fn();Object.defineProperty(HTMLElement.prototype,'animate',{configurable:true,value:animate});
  try {render(<MindMap session={exampleSession()}/>);const card=document.querySelector('.map-card.main') as HTMLDetailsElement,user=userEvent.setup();await user.click(card.querySelector('summary')!);await waitFor(()=>expect(animate).toHaveBeenCalledTimes(1));await user.click(card.querySelector('summary')!);await waitFor(()=>expect(card.open).toBe(false));await user.click(card.querySelector('summary')!);await waitFor(()=>expect(animate).toHaveBeenCalledTimes(2));}
  finally {if(previous)Object.defineProperty(HTMLElement.prototype,'animate',previous);else delete (HTMLElement.prototype as unknown as {animate?:unknown}).animate;}
});
