// imageProcessingUtils.js
import { NAILPOLISH } from '../consts/nail-polish';

/**
 * Parse RGB string to color object
 */
const parseRGBString = (rgbString) => {
  const values = rgbString.match(/\d+/g).map(Number);
  return { r: values[0], g: values[1], b: values[2] };
};

/**
 * Draw image maintaining aspect ratio
 */
const drawImageProp = (ctx, img, size) => {
  const imgRatio = img.width / img.height;
  let drawWidth = size;
  let drawHeight = size;
  let offsetX = 0;
  let offsetY = 0;

  if (imgRatio > 1) {
    drawHeight = size / imgRatio;
    offsetY = (size - drawHeight) / 2;
  } else {
    drawWidth = size * imgRatio;
    offsetX = (size - drawWidth) / 2;
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
};

/**
 * Get dominant color from the image
 */
const getDominantColor = (ctx, size) => {
  // Define ROI (Region of Interest)
  const centerX = size / 2;
  const centerY = size / 2;
  const roiWidth = Math.floor(size * 0.2);  // 20% del ancho
  const roiHeight = Math.floor(size * 0.4); // 40% del alto
  const roiOffsetY = Math.floor(-size * 0.05); // 5% hacia arriba

  const roi = {
    x: Math.floor(centerX - roiWidth / 2),
    y: Math.floor(centerY - roiHeight / 2 + roiOffsetY),
    width: roiWidth,
    height: roiHeight
  };

  // Draw debug rectangle
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = 2;
  ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);

  const imageData = ctx.getImageData(roi.x, roi.y, roi.width, roi.height).data;
  const colorMap = {};
  let totalPixels = 0;

  for (let i = 0; i < imageData.length; i += 4) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];

    // Skip white/near-white pixels
    const brightness = (r + g + b) / 3;
    if (brightness > 250) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;

    const quantization = saturation > 0.5 ? 8 : 16;
    const quantizedR = Math.floor(r / quantization) * quantization;
    const quantizedG = Math.floor(g / quantization) * quantization;
    const quantizedB = Math.floor(b / quantization) * quantization;

    const key = `${quantizedR},${quantizedG},${quantizedB}`;
    colorMap[key] = (colorMap[key] || 0) + (1 + saturation);
    totalPixels++;
  }

  if (totalPixels === 0) return { r: 0, g: 0, b: 0 };

  let maxWeight = 0;
  let dominantColor = { r: 0, g: 0, b: 0 };

  for (const key in colorMap) {
    if (colorMap[key] > maxWeight) {
      maxWeight = colorMap[key];
      const [r, g, b] = key.split(',').map(Number);
      dominantColor = { r, g, b };
    }
  }

  // Draw debug color text
  ctx.fillStyle = '#FF0000';
  ctx.font = '12px Arial';
  ctx.fillText(
    `RGB(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b})`,
    roi.x,
    roi.y - 5
  );

  return dominantColor;
};

/**
 * Pre-process image to enhance color detection
 */
const preProcessImage = (ctx, img, size) => {
  drawImageProp(ctx, img, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 510;
    const s = max === min ? 0 : (max - min) / (l > 0.5 ? (510 - max - min) : (max + min));

    // Enhance saturation and contrast
    const newS = Math.min(1, s * 2.0);
    const newL = l < 0.5 ? l * 0.7 : l * 1.3;

    const factor = newS * (newL < 0.5 ? newL : 1 - newL);

    if (max !== min) {
      data[i] = Math.min(255, Math.max(0, r + (r === max ? 1 : -1) * factor * 255));
      data[i + 1] = Math.min(255, Math.max(0, g + (g === max ? 1 : -1) * factor * 255));
      data[i + 2] = Math.min(255, Math.max(0, b + (b === max ? 1 : -1) * factor * 255));
    }
  }

  ctx.putImageData(imageData, 0, 0);
};

/**
 * Calculate color difference
 */
const calculateColorDifference = (color1, color2) => {
  const rDiff = Math.abs(color1.r - color2.r) / 255;
  const gDiff = Math.abs(color1.g - color2.g) / 255;
  const bDiff = Math.abs(color1.b - color2.b) / 255;
  return (rDiff + gDiff + bDiff) / 3;
};

/**
 * Main function to calculate image similarity
 */
/**
 * Main function to calculate image similarity
 */
export const calculateImageSimilarity = async (imageData1, polishId) => {
  return new Promise((resolve, reject) => {
    const img1 = new Image();
    
    img1.onload = () => {
      try {
        // Canvas para el análisis
        const canvas1 = document.createElement('canvas');
        const canvas2 = document.createElement('canvas'); // Canvas para debug
        const size = 200;
        
        canvas1.width = size;
        canvas1.height = size;
        canvas2.width = size;
        canvas2.height = size;
        
        const ctx1 = canvas1.getContext('2d', { willReadFrequently: true });
        const ctx2 = canvas2.getContext('2d');
        
        // Dibujar imagen original en ambos canvas
        drawImageProp(ctx1, img1, size);
        drawImageProp(ctx2, img1, size);
        
        // Procesar imagen en el canvas1 (análisis)
        preProcessImage(ctx1, img1, size);
        const capturedColor = getDominantColor(ctx1, size);
        
        // Dibujar área de análisis en el canvas2 (debug)
        const centerX = size / 2;
        const centerY = size / 2;
        const roiWidth = Math.floor(size * 0.2);
        const roiHeight = Math.floor(size * 0.4);
        const roiOffsetY = Math.floor(-size * 0.05);
        
        const roi = {
          x: Math.floor(centerX - roiWidth / 2),
          y: Math.floor(centerY - roiHeight / 2 + roiOffsetY),
          width: roiWidth,
          height: roiHeight
        };
        
        // Dibujar rectángulo de debug en canvas2
        ctx2.strokeStyle = '#00FF00'; // Verde para mejor visibilidad
        ctx2.lineWidth = 3;
        ctx2.strokeRect(roi.x, roi.y, roi.width, roi.height);
        
        // Dibujar etiqueta de color en canvas2
        ctx2.fillStyle = '#00FF00';
        ctx2.font = 'bold 14px Arial';
        const colorText = `RGB(${capturedColor.r}, ${capturedColor.g}, ${capturedColor.b})`;
        const textWidth = ctx2.measureText(colorText).width;
        ctx2.fillRect(roi.x, roi.y - 20, textWidth + 10, 20);
        ctx2.fillStyle = '#000000';
        ctx2.fillText(colorText, roi.x + 5, roi.y - 5);
        
        const polish = NAILPOLISH.find(p => p.id === polishId);
        if (!polish) {
          reject(new Error(`Esmalte no encontrado: ${polishId}`));
          return;
        }
        
        const polishColor = parseRGBString(polish.color);
        const similarity = 1 - calculateColorDifference(capturedColor, polishColor);
        
        // Log debug image (la versión con el rectángulo)
        console.log('Imagen original con área de análisis:', canvas2.toDataURL());
        console.log('Imagen procesada:', canvas1.toDataURL());
        
        console.log(`Comparando con esmalte ${polish.name} (${polishId}): ${(similarity * 100).toFixed(1)}%`);
        console.log(`Color capturado: rgb(${capturedColor.r}, ${capturedColor.g}, ${capturedColor.b})`);
        console.log(`Color del esmalte: ${polish.color}`);
        
        resolve(similarity);
      } catch (error) {
        reject(error);
      }
    };
    
    img1.onerror = () => {
      reject(new Error('Error al cargar la imagen capturada'));
    };
    
    img1.src = imageData1;
  });
};