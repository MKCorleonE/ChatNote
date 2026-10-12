export type Status = 'complete' | 'streaming' | 'stopped' | 'error';
export interface Attachment { id: string; name: string; mime: string; size: number; kind: 'text' | 'image' | 'document' }
import type { Language } from './i18n';
export interface Message { id: string; revision: string; role: 'user' | 'assistant'; text: string; status: Status; createdAt: number; attachments?:Attachment[]; questionGroupId?:string; model?: string; reasoningEffort?: ReasoningEffort; connectionId?: string; connectionName?: string; error?: string; promotedFrom?: string; context?: ContextReport; phase?:'connecting'|'generating'; completedAt?:number; firstTextAt?:number }
export interface Anchor { messageId: string; revision: string; start: number; end: number; quote: string; prefix: string; suffix: string }
export interface Branch { id: string; parentId: string | null; anchor: Anchor; messages: Message[]; activeMessageIds?:string[]; messageHistory?: Message[][]; createdAt: number; sourceContext: ContextItem[]; note?:string }
export interface View { mode: 'closed' | 'branch' | 'tree'; branchId: string | null; drafts: Record<string, string>; positions: Record<string, { messageId: string; offset: number; scrollTop: number }>; collapsed: string[]; attachmentDrafts?:Record<string,Attachment[]>; draftSource?:{anchor:Anchor;parentId:string|null} }
export interface Session { id: string; title: string; createdAt: number; updatedAt: number; messages: Message[]; activeMessageIds?:string[]; messageHistory?: Message[][]; branches: Branch[]; view: View; example?: boolean }
export type ProviderKind = 'openai' | 'chatgpt' | 'compatible';
export type Preset = 'openai' | 'chatgpt' | 'deepseek' | 'qwen' | 'custom';
export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra';
export interface ComposerGlow { enabled: boolean; colorA: string; colorB: string; seconds: number; brightness: number }
export interface AnnotationHighlight { color: 'yellow' | 'green' | 'cyan' | 'pink' | 'purple' | 'orange'; opacity: number }
export interface CatalogSnapshot { provider: ProviderKind; endpoint: string; models: Model[]; updatedAt: number }
export interface ConnectionProfile { id: string; name: string; preset: Preset; provider: ProviderKind; endpoint: string; model: string; reasoningEffort?: ReasoningEffort; imageInput?:boolean; transcriptionModel?:string; checkedAt?: number; checkState?: 'catalog' | 'error'; checkMessage?: string }
export interface LearningPreferences { selectedId?: string; customPrompt?: string; presets?: { id: string; name: string; prompt: string }[] }
export interface Settings { provider: ProviderKind; endpoint: string; model: string; reasoningEffort?: ReasoningEffort; profiles?: ConnectionProfile[]; activeProfileId?: string; modelCatalogs?: Record<string, CatalogSnapshot>; panelWidth?: number; historyPinned?:boolean; composerGlow?: ComposerGlow; annotationHighlight?: AnnotationHighlight; language?: Language; fontSize: number; annotations: boolean; theme: 'dark' | 'light'; followSystemTheme?: boolean; contextBudget: number; welcomeVersion?:string; voiceProfileId?:string; learningPreferences?:LearningPreferences; treeLayout?:'trail'|'map' }
export interface Workspace { version: 1; sessions: Session[]; activeId: string; settings: Settings }
export interface ContextItem { role: 'user' | 'assistant'; content: string; attachments?: Attachment[] }
export interface ContextReport { source: string; characters: number; budget: number; summarized: boolean; omittedTurns: number; items: ContextItem[] }
export interface Connection { apiKey: boolean; compatibleKey: boolean; chatgpt: boolean; email?: string; planUsage?: boolean; legacyCompatibleEndpoint?: string }
export interface ProfileStatus { hasKey: boolean; endpointMatches: boolean; connected: boolean; planUsage: boolean; email?: string; registered?:boolean;refreshable?:boolean }
export interface UsageInfo { kind: 'balance' | 'external'; available?: boolean; balances?: { currency: string; total: string; granted: string; toppedUp: string }[]; url: string; checkedAt?: number }
export interface Model { id: string; name: string; reasoningEfforts?: ReasoningEffort[]; defaultReasoningEffort?: ReasoningEffort }
export interface Generation { requestId: string; provider: ProviderKind; endpoint: string; profileId?: string; model: string; reasoningEffort?: ReasoningEffort; input: ContextItem[]; instructions: string; imageInput?:boolean }
export interface StreamEvent { type: 'delta' | 'done' | 'error'; text?: string; error?: string }
