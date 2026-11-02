'use strict';
// 小小桌宠 WebM 角色 ↔ CrossPet 合集（同一人设/形象，不重复占卡）
// 未映射的 CrossPet 角色（如 gemini）会在主页单独成卡
const WEB_TO_CROSSPET = {
  main: 'deepseek',       // 蓝毛小女仆
  ojousama: 'claude',     // 橙毛大小姐
  character3: 'grok',     // 黄毛该溜子
  character4: 'gpt',      // 白毛小龙娘
  character5: 'glm',      // 黑毛小狐狸
  character6: 'qwen',     // 奶茶千金
};

function crosspetIdFor(webmId) {
  return WEB_TO_CROSSPET[webmId] || null;
}

function webmIdFor(crosspetId) {
  return Object.keys(WEB_TO_CROSSPET).find((k) => WEB_TO_CROSSPET[k] === crosspetId) || null;
}

/** 有小小桌宠 WebM 对应的才可选「动作原版」；Gemini 这类孤儿只能走 CrossPet */
function hasWebmTwin(crosspetId) {
  return !!webmIdFor(crosspetId);
}

module.exports = { WEB_TO_CROSSPET, crosspetIdFor, webmIdFor, hasWebmTwin };
