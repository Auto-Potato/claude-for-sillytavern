/** Use the host replacement endpoint; the avatar filename owns the chat folder. */
export async function replaceCharacterCard({file,avatar,userName,request,isBusy}) {
  if(isBusy())throw new Error('请等待生成或聊天保存完成');
  const format=file.name.split('.').pop().toLowerCase();
  if(!['png','json','charx','byaf','yaml','yml'].includes(format))throw new Error('请选择角色卡文件');
  const form=new FormData();
  form.append('avatar',file);form.append('file_type',format);
  form.append('user_name',userName);form.append('preserved_name',avatar);
  const response=await request(form);
  if(!response.ok)throw new Error('更新角色卡失败，请检查文件后重试');
  const result=await response.json();
  if(result.error||`${result.file_name}.png`!==avatar)throw new Error('角色卡更新结果异常，请重新打开详情检查');
}
