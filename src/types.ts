export type Status = 'complete' | 'streaming' | 'stopped' | 'error';
import type { Language } from './i18n';
export interface Message { id: string; revision: string; role: 'user' | 'assistant'; text: string; status: Status; createdAt: number; model?: string; connectionId?: string; connectionName?: string; error?: string; promotedFrom?: string; context?: ContextReport }
export interface Anchor { messageId: string; revision: string; start: number; end: number; quote: string; prefix: string; suffix: string }
export interface Branch { id: string; parentId: string | null; anchor: Anchor; messages: Message[]; createdAt: number; sourceContext: ContextItem[] }
export interface View { mode: 'closed' | 'branch' | 'tree'; branchId: string | null; drafts: Record<string, string>; positions: Record<string, { messageId: string; offset: number; scrollTop: number }>; collapsed: string[] }
export interface Session { id: string; title: string; createdAt: number; updatedAt: number; messages: Message[]; branches: Branch[]; view: View; example?: boolean }
export type ProviderKind = 'openai' | 'chatgpt' | 'compatible';
export type Preset = 'openai' | 'chatgpt' | 'deepseek' | 'qwen' | 'custom';
export interface ConnectionProfile { id: string; name: string; preset: Preset; provider: ProviderKind; endpoint: string; model: string; checkedAt?: number; checkState?: 'catalog' | 'error'; checkMessage?: string }
export interface Settings { provider: ProviderKind; endpoint: string; model: string; profiles?: ConnectionProfile[]; activeProfileId?: string; language?: Language; fontSize: number; annotations: boolean; theme: 'dark' | 'light'; contextBudget: number }
export interface Workspace { version: 1; sessions: Session[]; activeId: string; settings: Settings }
export interface ContextItem { role: 'user' | 'assistant'; content: string }
export interface ContextReport { source: string; characters: number; budget: number; summarized: boolean; omittedTurns: number; items: ContextItem[] }
export interface Connection { apiKey: boolean; compatibleKey: boolean; chatgpt: boolean; email?: string; planUsage?: boolean; legacyCompatibleEndpoint?: string }
export interface ProfileStatus { hasKey: boolean; endpointMatches: boolean; connected: boolean; planUsage: boolean; email?: string }
export interface UsageInfo { kind: 'balance' | 'external'; available?: boolean; balances?: { currency: string; total: string; granted: string; toppedUp: string }[]; url: string; checkedAt?: number }
export interface Model { id: string; name: string }
export interface Generation { requestId: string; provider: ProviderKind; endpoint: string; profileId?: string; model: string; input: ContextItem[]; instructions: string }
export interface StreamEvent { type: 'delta' | 'done' | 'error'; text?: string; error?: string }
