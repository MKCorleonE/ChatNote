import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect,test,vi } from 'vitest';
import { ChoiceMenu } from './ChoiceMenu';
const options=[{value:'',label:'Provider default'},{value:'low',label:'Low'},{value:'high',label:'High'}];
test('Rounded choices support keyboard selection, restore focus and do not submit a parent form',async()=>{
 const change=vi.fn(),submit=vi.fn(),user=userEvent.setup();render(<form onSubmit={submit}><ChoiceMenu label="Reasoning effort" value="" options={options} onChange={change}/></form>);const trigger=screen.getByRole('combobox',{name:'Reasoning effort'});
 trigger.focus();await user.keyboard('{ArrowDown}');expect(document.activeElement).toBe(screen.getByRole('listbox'));await user.keyboard('{End}{Enter}');expect(change).toHaveBeenCalledWith('high');expect(document.activeElement).toBe(trigger);expect(submit).not.toHaveBeenCalled();await waitFor(()=>expect(screen.queryByRole('listbox')).toBeNull());
});
test('Escape and outside presses close choices without changing the selected value',async()=>{
 const change=vi.fn(),user=userEvent.setup();render(<><ChoiceMenu label="Choice" value="low" options={options} onChange={change}/><button>Outside</button></>);const trigger=screen.getByRole('combobox');await user.click(trigger);expect(screen.getByRole('option',{name:'Low'}).getAttribute('aria-selected')).toBe('true');await user.keyboard('{ArrowDown}{Escape}');expect(change).not.toHaveBeenCalled();expect(document.activeElement).toBe(trigger);await user.click(trigger);fireEvent.pointerDown(screen.getByRole('button',{name:'Outside'}));await waitFor(()=>expect(screen.queryByRole('listbox')).toBeNull());expect(change).not.toHaveBeenCalled();
});
test('Disabled controls close an already open menu and reject interaction',async()=>{const change=vi.fn(),user=userEvent.setup(),view=render(<ChoiceMenu label="Choice" value="" options={options} onChange={change}/>);await user.click(screen.getByRole('combobox'));view.rerender(<ChoiceMenu label="Choice" value="" options={options} onChange={change} disabled/>);await waitFor(()=>expect(screen.queryByRole('listbox')).toBeNull());expect(screen.getByRole('combobox').hasAttribute('disabled')).toBe(true);expect(change).not.toHaveBeenCalled();});

test('A floating menu stays open when focus or surrounding scroll moves it, then Escape returns to its trigger',async()=>{
  const user=userEvent.setup();render(<ChoiceMenu label="Appearance choice" value="low" options={options} onChange={()=>{}} placement="below"/>);
  const trigger=screen.getByRole('combobox');await user.click(trigger);fireEvent.scroll(document);
  expect(screen.getByRole('listbox')).toBeDefined();expect(trigger.getAttribute('aria-expanded')).toBe('true');
  await user.keyboard('{Escape}');expect(document.activeElement).toBe(trigger);await waitFor(()=>expect(screen.queryByRole('listbox')).toBeNull());
});
