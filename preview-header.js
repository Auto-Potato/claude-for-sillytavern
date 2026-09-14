// Preview-only comparison; does not change saved theme preferences.
const chooser = document.createElement('select');
chooser.setAttribute('aria-label', '消息标题对比');
chooser.innerHTML = '<option value="current">A · 卡名居中 / 时间底对齐</option><option value="original">B · 同布局 + 原版字体字号</option><option value="original-inline">C · 原版字体字号 / 时间不换行</option><option value="original-bottom">D · 卡名时间都居底 / 原版字体 / 单行时间</option>';
document.querySelector('header').append(chooser);
const previewFrame = document.querySelector('iframe');
function applyHeaderVariant() {
  previewFrame.contentDocument?.documentElement.setAttribute('data-cwn-header-font', chooser.value);
}
chooser.addEventListener('change', applyHeaderVariant);
previewFrame.addEventListener('load', applyHeaderVariant);
applyHeaderVariant();
