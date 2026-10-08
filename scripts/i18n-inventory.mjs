import fs from 'node:fs';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse=traverseModule.default??traverseModule,strings=new Set();
for(const file of ['src/App.tsx','src/Settings.tsx','src/RichText.tsx']){const ast=parse(fs.readFileSync(file,'utf8'),{sourceType:'module',plugins:['typescript','jsx']});traverse(ast,{JSXText(p){const text=p.node.value.replace(/\s+/g,' ').trim();if(/[A-Za-z]/.test(text))strings.add(text);},JSXAttribute(p){if(['title','aria-label','placeholder'].includes(p.node.name.name)&&p.node.value?.type==='StringLiteral')strings.add(p.node.value.value);},StringLiteral(p){if(p.node.value.includes(' ')&&/[A-Z]/.test(p.node.value[0])&&!p.node.value.includes('ChatNote/'))strings.add(p.node.value);}});}
fs.mkdirSync('.cache',{recursive:true});fs.writeFileSync('.cache/i18n-inventory.json',JSON.stringify([...strings].sort(),null,2));console.log([...strings].sort().join('\n'));
