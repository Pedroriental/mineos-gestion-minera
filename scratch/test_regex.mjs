const cleanText = "El trabajador Enio Mrtinez              25392130    enviado a su casa accidente laboral, se paga la semana de trabajo.\nUSD                                      100";

const usdMatch = cleanText.match(/(?:usd|\$|dolares|dólares)\s*(\d+(?:[.,]\d{1,2})?)\b/i) || 
                 cleanText.match(/\b(\d+(?:[.,]\d{1,2})?)\s*(?:usd|\$|dolares|dólares)\b/i);

console.log('usdMatch:', usdMatch);
if (usdMatch) {
  console.log('usdMatch[1]:', usdMatch[1]);
}

const nameMatch = cleanText.match(/(?:el\s+)?trabajador\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑa-záéíóúñ\s'.-]{2,50})/i);
console.log('nameMatch:', nameMatch);
if (nameMatch) {
  console.log('nameMatch[1]:', nameMatch[1].trim());
}
