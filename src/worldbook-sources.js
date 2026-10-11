import { accountStorage } from '../../../../util/AccountStorage.js';
const key='cwn-worldbook-sources';
function sources(){try{const value=JSON.parse(accountStorage.getItem(key)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
export function worldbookSource(name){const all=sources();return Object.hasOwn(all,name)?all[name]:undefined;}
export function recordWorldbookSource(name,card){let all=sources();if(card?.avatar)all={...all,[name]:{avatar:card.avatar,name:card.name}};else delete all[name];accountStorage.setItem(key,JSON.stringify(all));}
