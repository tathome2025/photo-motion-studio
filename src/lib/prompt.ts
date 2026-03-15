export function buildGenerationPrompt(actionPrompt: string) {
  const normalizedAction = actionPrompt.trim();

  return [
    "只使用相片中央真實的人物與場景內容。",
    "若畫面左右存在延展背景、模糊補邊或補畫區域，將其只視為背景參考。",
    "不要讓補邊區域、邊緣痕跡或人工延展背景成為可見主體或動態元素。",
    "將畫面自然延展為完整 16:9 橫向構圖，合理補足背景與畫面邊緣。",
    "保持人物外貌、服裝、髮型、光線、相片氛圍與場景一致。",
    `動作要求：${normalizedAction}`,
  ].join(" ");
}
