import { expect,test,vi } from 'vitest';
import { render,screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { exampleSession,makeAnchor,message,snapshot } from './core';
import { editThread } from './message-history';
import { FollowUpTree } from './FollowUpTree';
test('Children of a saved answer version remain navigable after their parent thread is edited',async()=>{
 const s=exampleSession(),b=s.branches[0],anchor=makeAnchor(b.messages[1],0,16),child={id:crypto.randomUUID(),parentId:b.id,anchor,messages:[message('user','Saved-version child question'),message('assistant','Child answer')],createdAt:Date.now(),sourceContext:snapshot(s,b.id,anchor)};s.branches.push(child);s.branches[0]=editThread(b,b.messages[0].id,'Edited question',message('assistant','Edited answer'));const open=vi.fn(),user=userEvent.setup();render(<FollowUpTree session={s} onOpen={open} onCollapsed={vi.fn()}/>);
 expect(screen.getByText('Annotations from saved answer versions')).toBeDefined();await user.click(screen.getByText('Saved-version child question'));expect(open).toHaveBeenCalledWith(child.id,child.messages[0].id);
});
