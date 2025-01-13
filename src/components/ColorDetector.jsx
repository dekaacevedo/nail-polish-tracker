import React, { useRef, useEffect, useState } from 'react';
import { Camera, Plus, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NAILPOLISH } from '../consts/nail-polish';

const ColorDetector = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [dominantColor, setDominantColor] = useState({ r: 0, g: 0, b: 0 });
  const [colorHistory] = useState(Array(10).fill({ r: 0, g: 0, b: 0 }));
  const [isStreaming, setIsStreaming] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [capturedColors, setCapturedColors] = useState([]);
  const [matchedPolish, setMatchedPolish] = useState(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 480,
          height: 640, 
          facingMode: 'environment'
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
        setIsFrozen(false);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
  
    const handleLoadedMetadata = () => {
      setDimensions({
        width: video.videoWidth,
        height: video.videoHeight
      });
    };
  
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  const analyzeFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isStreaming || isFrozen) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const video = videoRef.current;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const centerX = Math.floor(canvas.width / 2);
    const centerY = Math.floor(canvas.height / 2);
    const radius = 70;

    const imageData = context.getImageData(
      centerX - radius,
      centerY - radius * 1.5,
      radius * 2,
      radius * 3
    );

    let r = 0, g = 0, b = 0;
    const pixels = imageData.data.length / 4;

    for (let i = 0; i < imageData.data.length; i += 4) {
      r += imageData.data[i];
      g += imageData.data[i + 1];
      b += imageData.data[i + 2];
    }

    const newColor = {
      r: Math.round(r / pixels),
      g: Math.round(g / pixels),
      b: Math.round(b / pixels)
    };

    colorHistory.shift();
    colorHistory.push(newColor);

    const averageColor = {
      r: Math.round(colorHistory.reduce((sum, color) => sum + color.r, 0) / colorHistory.length),
      g: Math.round(colorHistory.reduce((sum, color) => sum + color.g, 0) / colorHistory.length),
      b: Math.round(colorHistory.reduce((sum, color) => sum + color.b, 0) / colorHistory.length)
    };

    setDominantColor(averageColor);

    const closest = findClosestNailPolish(averageColor);
    setMatchedPolish(closest);

    requestAnimationFrame(analyzeFrame);
  };

  useEffect(() => {
    if (isStreaming && !isFrozen) {
      analyzeFrame();
    }
  }, [isStreaming, isFrozen]);

  const getColorName = (r, g, b) => {
    const sum = r + g + b;
    const max = Math.max(r, g, b);
    
    if (sum < 150) return 'Negro';
    if (sum > 700) return 'Blanco';
    
    if (max === r) {
      if (g > 150 && b < 150) return 'Amarillo';
      return 'Rojo';
    }
    if (max === g) return 'Verde';
    if (max === b) return 'Azul';
    
    return 'Desconocido';
  };

  const captureColor = () => {
    setIsFrozen(true);
    stopCamera();

    const colorName = getColorName(dominantColor.r, dominantColor.g, dominantColor.b);
    const capturedColor = {
      ...dominantColor,
      name: colorName,
      timestamp: new Date().toLocaleTimeString(),
      matchedPolish: matchedPolish ? [...matchedPolish] : null
    };
    setCapturedColors(prev => [...prev, capturedColor]);
  };

  const resumeCapture = () => {
    startCamera();
    setCapturedColors([]); // Limpiamos el historial de capturas
  };

  const colorName = getColorName(dominantColor.r, dominantColor.g, dominantColor.b);
  const rgbString = `rgb(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b})`;

  const getColorDistance = (color1, color2) => {
    return Math.sqrt(
      Math.pow(color1.r - color2.r, 2) +
      Math.pow(color1.g - color2.g, 2) +
      Math.pow(color1.b - color2.b, 2)
    );
  };

  const parseRgb = (rgbStr) => {
    const matches = rgbStr.match(/rgb\((\d+)\s+(\d+)\s+(\d+)\)/);
    if (!matches) return null;
    return {
      r: parseInt(matches[1]),
      g: parseInt(matches[2]),
      b: parseInt(matches[3])
    };
  };

  const findClosestNailPolish = (detectedColor) => {
    const polishesWithDistance = NAILPOLISH.map(polish => {
      const polishRGB = parseRgb(polish.color);
      if (!polishRGB) return null;
  
      const distance = getColorDistance(detectedColor, polishRGB);
      // La distancia máxima posible en el espacio RGB es sqrt(255^2 * 3) ≈ 441.67
      const similarity = Math.max(0, Math.min(100, ((441.67 - distance) / 441.67) * 100));
      
      return { 
        ...polish, 
        distance,
        similarity: Math.round(similarity)
      };
    }).filter(Boolean);

    // Ordenamos por similitud y tomamos los 4 más cercanos
    return polishesWithDistance.sort((a, b) => b.similarity - a.similarity).slice(0, 4);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mb-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-6 w-6" />
          Detector de Colores
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Sección del video */}
          <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 flex flex-col items-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <canvas
              ref={canvasRef}
              width="480"
              height="640"
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            />
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              maskImage: 'radial-gradient(circle at center, transparent 48px, black 48px)',
              WebkitMaskImage: 'radial-gradient(circle at center, transparent 48px, black 48px)',
            }} />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="w-24 h-24 border-2 border-white rounded-full" />
            </div>
            <div className="absolute bottom-0 flex gap-2 mb-5">
              {!isFrozen ? (
                <Button 
                  onClick={captureColor}
                  className="flex items-center w-32 bg-purple-600 gap-2 p-4"
                >
                  <Plus className="h-4 w-4" />
                  Capturar
                </Button>
              ) : (
                <Button 
                  onClick={resumeCapture}
                  className="flex items-center w-32 bg-green-600 gap-2 p-4"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reanudar
                </Button>
              )}
            </div>
          </div>

          {/* Lista de colores capturados */}
          {capturedColors.length > 0 && (
            <div className="grid grid-cols-1 mt-4">
              {capturedColors.map((color, index) => (
                <div>
                  {color.matchedPolish.map((polish, idx) => (
                  <article className="flex flex-col justify-between border rounded-lg shadow-sm bg-white">
                    <div className="flex flex-col mb-2">
                      <div className="flex flex-row items-center gap-4">
                        <h2 class="font-semibold text-lg pt-4 pl-4">{polish.name}</h2>
                        <img 
                          className="w-auto h-9 pt-4" 
                          src={`https://nailpolish.s3.us-east-1.amazonaws.com/brand/${polish.brand}.webp`} 
                          alt={`Logo ${polish.brand}`}
                        />
                      </div>
                      {polish.collection && (
                        <p className="text-sm pl-4 text-gray-500">{polish.collection}</p>
                        )}
                      <div style={{ backgroundColor: polish.color}} className={`w-full mt-3 rounded-b-lg p-3 flex flex-row items-center gap-3 ${textColor}`}>
                      </div>
                    </div>
                  </article>
                ))}
                </div>
              ))}
            </div>

          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ColorDetector;


{/*
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
  <article class="flex flex-col justify-between border rounded-lg shadow-sm bg-white">
                    <div class="flex flex-col mb-2">
                        <div class="flex flex-row items-center gap-4">
                            <h2 class="font-semibold text-lg pt-4 pl-4">{polish.name}</h2>
                            <img class="w-auto h-9 pt-4" src={`https://nailpolish.s3.us-east-1.amazonaws.com/brand/${polish.brand}.webp`} alt={`Logo ${polish.brand}`}>
                        </div>
                        {polish.collection && (
                        <p class="text-sm pl-4 text-gray-500">{polish.collection}</p>
                        )}
                    </div>
                <div
                    style={{ backgroundColor: polish.color}}
                    class={`w-full mt-3 rounded-b-lg p-3 flex flex-row items-center gap-3 ${textColor}`}
                >
                {polish.feature && (
                    <span class="text-sm">
                    {polish.feature}
                    </span>
                )}
                    <img 
                        src={`https://nailpolish.s3.us-east-1.amazonaws.com/level/${polish.level}.svg`}
                        alt="" 
                        class={`w-2 ${svgFilter}`}
                    />
                </div>
            </article>*/}


                        {/*<div className="mt-6 flex flex-col w-full h-auto p-4">
                {capturedColors.map((color, index) => (
                  <div className='flex flex-row'>
                    {color.matchedPolish.map((polish, idx) => (
                      <div className='flex  flex-row items-center gap-2'>
                        <div className=" w-3 h-3 rounded-full border" style={{ backgroundColor: polish.color }} />
                        <div className='flex flex-col'>
                          <span className="text-sm font-semibold">{polish.name}</span>
                          <span className="text-xs text-purple-600"> {polish.similarity}% de similitud </span>
                        </div>
                      </div>
                    ))}

                  </div>
                ))}
            </div>*/}