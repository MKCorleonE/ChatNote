import { test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const fake=vi.hoisted(()=>({status:vi.fn(),check:vi.fn(),download:vi.fn(),install:vi.fn(),listen:vi.fn()}));
vi.mock('./updates',async importOriginal=>({...await importOriginal<typeof import('./updates')>(),updateApi:{...fake,enabled:true}}));
import { savedInstall, updatePercent } from './updates';
import { useAppUpdates } from './useAppUpdates';
import { UpdateCard } from './UpdateCard';
const state=(phase:string,extra={})=>({phase,downloaded:0,...extra});
beforeEach(()=>{
 vi.clearAllMocks();fake.status.mockResolvedValue(state('idle'));fake.check.mockResolvedValue(state('current'));fake.download.mockResolvedValue(state('ready',{version:'0.13.1',total:100,downloaded:100}));fake.listen.mockResolvedValue(()=>{});fake.install.mockResolvedValue(undefined);
});
test('Installation waits for persistence and never runs after a failed save',async()=>{
 let release!:()=>void;const order:string[]=[],save=vi.fn(()=>new Promise<void>(resolve=>{release=()=>{order.push('saved');resolve();};})),install=vi.fn(async()=>{order.push('installed');});
 const pending=savedInstall(save,install);expect(install).not.toHaveBeenCalled();release();await pending;expect(order).toEqual(['saved','installed']);
 install.mockClear();await expect(savedInstall(async()=>{throw new Error('disk full');},install)).rejects.toThrow('disk full');expect(install).not.toHaveBeenCalled();
});
test('Manual checks download a new version but installation remains user-controlled',async()=>{
 fake.check.mockResolvedValue(state('available',{version:'0.13.1'}));const save=vi.fn(async()=>{});
 function Harness(){const updates=useAppUpdates(false,save);return <UpdateCard updates={updates}/>;}
 render(<Harness/>);await screen.findByText('Keep ChatNote up to date');await userEvent.click(screen.getByRole('button',{name:'Check for updates'}));
 await screen.findByText('ChatNote 0.13.1 is ready');expect(fake.download).toHaveBeenCalledTimes(1);expect(fake.install).not.toHaveBeenCalled();
 await userEvent.click(screen.getByRole('button',{name:'Restart and update'}));await waitFor(()=>expect(fake.install).toHaveBeenCalledTimes(1));expect(save).toHaveBeenCalledTimes(1);
});
test('A cached update is shown without redownloading or installing from the running UI',async()=>{
 fake.status.mockResolvedValue(state('ready',{version:'0.13.1'}));function Harness(){return <UpdateCard updates={useAppUpdates(true,async()=>{})} blocked/>;}
 render(<Harness/>);await screen.findByText('ChatNote 0.13.1 is ready');expect((screen.getByRole('button',{name:'Restart and update'}) as HTMLButtonElement).disabled).toBe(true);expect(fake.check).not.toHaveBeenCalled();expect(fake.download).not.toHaveBeenCalled();expect(fake.install).not.toHaveBeenCalled();
});
test('Save failures leave the update ready and do not invoke the installer',async()=>{
 fake.status.mockResolvedValue(state('ready',{version:'0.13.1'}));function Harness(){return <UpdateCard updates={useAppUpdates(false,async()=>{throw new Error('save failed');})}/>;}
 render(<Harness/>);await screen.findByText('ChatNote 0.13.1 is ready');await userEvent.click(screen.getByRole('button',{name:'Restart and update'}));await screen.findByText(/Could not save your workspace/);expect(fake.install).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Restart and update'})).toBeDefined();
});
test('Download progress handles unknown lengths and clamps overshoot',()=>{
 expect(updatePercent({phase:'downloading',downloaded:5})).toBeUndefined();expect(updatePercent({phase:'downloading',downloaded:150,total:100})).toBe(100);
});
test('A failed download offers retry and never schedules installation',async()=>{
 fake.check.mockResolvedValue(state('available',{version:'0.13.1'}));fake.download.mockRejectedValueOnce(new Error('offline'));
 function Harness(){return <UpdateCard updates={useAppUpdates(false,async()=>{})}/>;}
 render(<Harness/>);await screen.findByText('Keep ChatNote up to date');await userEvent.click(screen.getByRole('button',{name:'Check for updates'}));await screen.findByRole('button',{name:'Retry download'});expect(fake.install).not.toHaveBeenCalled();
});
