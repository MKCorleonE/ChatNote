/// <reference types="vite/client" />
declare module 'katex' { const katex:{renderToString:(text:string,options:Record<string,unknown>)=>string};export default katex; }
