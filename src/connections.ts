import type { ConnectionProfile, Preset, Settings } from './types';
export const presets: { id: Preset; name: string; provider: ConnectionProfile['provider']; endpoint: string; model: string; hint: string }[] = [
  { id:'chatgpt', name:'ChatGPT plan', provider:'chatgpt', endpoint:'https://api.openai.com/v1', model:'', hint:'Uses the connected ChatGPT account and its plan allowance.' },
  { id:'openai', name:'OpenAI API', provider:'openai', endpoint:'https://api.openai.com/v1', model:'', hint:'Uses your OpenAI API account, separate from ChatGPT plan usage.' },
  { id:'deepseek', name:'DeepSeek', provider:'compatible', endpoint:'https://api.deepseek.com', model:'deepseek-flash', hint:'Your DeepSeek API key. Available balance can be checked without generating an answer.' },
  { id:'qwen', name:'Qwen · Alibaba Model Studio', provider:'compatible', endpoint:'https://dashscope.aliyuncs.com/compatible-mode/v1', model:'', hint:'Default address: China (Beijing). Use a key and address from the same region. A workspace-specific or plan address can be entered below.' },
  { id:'custom', name:'Custom provider', provider:'compatible', endpoint:'', model:'', hint:'Enter your provider’s Chat Completions base URL, API key and model.' },
];
export function newProfile(preset: Preset): ConnectionProfile { const p=presets.find(p=>p.id===preset)!;return {id:crypto.randomUUID(),name:p.name,preset:p.id,provider:p.provider,endpoint:p.endpoint,model:p.model}; }
export function activeProfile(s: Settings): ConnectionProfile | undefined { return s.profiles?.find(p=>p.id===s.activeProfileId); }
export function syncActive(s: Settings): Settings { const p=activeProfile(s);return p?{...s,provider:p.provider,endpoint:p.endpoint,model:p.model}:s; }
export function activateProfile(s: Settings,id: string): Settings { if(!s.profiles?.some(p=>p.id===id))return s;return syncActive({...s,activeProfileId:id}); }
export function migrateConnections(s: Settings,legacyEndpoint?: string): Settings {
  if(s.profiles?.length)return syncActive(s);
  const openai:ConnectionProfile={id:'legacy-openai',name:'OpenAI API',preset:'openai',provider:'openai',endpoint:'https://api.openai.com/v1',model:s.provider==='openai'?s.model:''};
  const chatgpt:ConnectionProfile={id:'legacy-chatgpt',name:'ChatGPT plan',preset:'chatgpt',provider:'chatgpt',endpoint:'https://api.openai.com/v1',model:s.provider==='chatgpt'?s.model:''};
  const profiles=[chatgpt,openai];
  if(s.provider==='compatible'||legacyEndpoint)profiles.push({id:'legacy-compatible',name:'Existing custom connection',preset:'custom',provider:'compatible',endpoint:legacyEndpoint || s.endpoint,model:s.provider==='compatible'?s.model:''});
  return syncActive({...s,profiles,activeProfileId:s.provider==='chatgpt'?chatgpt.id:s.provider==='openai'?openai.id:'legacy-compatible'});
}
export function usageUrl(p:ConnectionProfile):string { if(p.provider==='chatgpt')return 'https://chatgpt.com/#settings/Usage';if(p.provider==='openai')return 'https://platform.openai.com/usage';if(p.preset==='deepseek')return 'https://platform.deepseek.com/';if(p.preset==='qwen')return 'https://bailian.console.aliyun.com/';return ''; }
export function friendlyError(input:unknown):{ title:string; message:string; detail:string; quota:boolean } {
  const detail=typeof input==='string'?input:input instanceof Error?input.message:JSON.stringify(input);
  const text=detail.toLowerCase();const result=(title:string,message:string,quota=false)=>({title,message,detail,quota});
  if(/session renewal is temporarily unavailable/.test(text))return result('Temporary ChatGPT connection problem','Your saved session was kept. Check your network or retry later; disconnecting is not needed for a temporary error.');
  if(/sign-in was cancelled/.test(text))return result('Sign-in cancelled','Close the old authorization tab before trying again. Your saved registration and conversations are kept.');
  if(/sign-in timed out/.test(text))return result('Browser authorization timed out','Close the old authorization tab and start sign-in again. If the browser page also times out, check its connection to ChatGPT. Your saved registration is kept.');
  if(/sign-in service/.test(text))return result('Could not reach the sign-in service','Check your network and try again later. This check uses no model quota and does not change your saved connection.');
  if(/save your api key|not connected|connect your chatgpt|missing.*key/.test(text))return result('Not connected','Save an API key or connect ChatGPT in Settings first.');
  if(/subscription_sharing_usage_limit_exceeded|insufficient_quota|quota.exceeded|balance.*insufficient|402/.test(text))return result('Usage limit reached','This connection cannot currently make new requests. Check its provider usage page or select another saved connection. No automatic billing fallback was used.',true);
  if(/429|rate.?limit|too many requests/.test(text))return result('Temporarily limited','The provider is limiting requests. Wait and try again, or select another connection. A 429 alone does not establish that your full plan is empty.',true);
  if(/different api url|endpoint.*match/.test(text))return result('Address and key do not match','This saved key belongs to a different service address. Restore the previous address, or save the corresponding key for this address.');
  if(/401|invalid.api.key|incorrect.api.key|unauthorized|authentication|expired|revoked|reconnect|refresh/.test(text))return result('Connection needs attention','Check the API key, or reconnect your ChatGPT account. Your conversations and other saved connections are kept.');
  if(/403|not.eligible|permission|not.authorized/.test(text))return result('Access not granted','This account, model or region is not permitted for the request. Check the selected connection and its access permissions.');
  if(/404|model.*not.*found|model.*not.*exist|invalid.model/.test(text))return result('Model or address unavailable','Check the exact model ID and service address. Some providers do not expose a model directory; you can enter a model ID manually.');
  if(/503|502|500|unavailable|overloaded/.test(text))return result('Provider temporarily unavailable','Keep this connection and try again later. No request was moved to another provider.');
  if(/connect|network|timeout|timed out|dns/.test(text))return result('Could not reach the provider','Check your network and the service address, then try again.');
  if(/save your api key|not connected|connect your chatgpt|missing.*key/.test(text))return result('Not connected','Save an API key or connect ChatGPT in Settings first.');
  return result('Request could not be completed','Review the provider details below, then check your connection and model.');
}

