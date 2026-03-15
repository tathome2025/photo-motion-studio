export function buildGenerationPrompt(actionPrompt: string) {
  const normalizedAction = actionPrompt.trim();

  return [
    "只使用相片中央真實的人物與場景內容。",
    "忽略左右黑色填充邊、黑框、pillarbox 或任何黑色側邊。",
    "不要把黑邊納入生成畫面，不要讓黑邊出現、移動或被保留在影片內。",
    "將畫面自然延展為完整 16:9 橫向構圖，合理補足背景與畫面邊緣。",
    "保持人物外貌、服裝、髮型、光線、相片氛圍與場景一致。",
    `動作要求：${normalizedAction}`,
  ].join(" ");
}
