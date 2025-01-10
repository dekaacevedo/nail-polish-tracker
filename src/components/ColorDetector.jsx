import React, { useRef, useEffect, useState } from 'react';
import { Camera, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const ColorDetector = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [dominantColor, setDominantColor] = useState({ r: 0, g: 0, b: 0 });
  const [colorHistory] = useState(Array(10).fill({ r: 0, g: 0, b: 0 }));
  const [isStreaming, setIsStreaming] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  // New state for captured colors
  const [capturedColors, setCapturedColors] = useState([]);

  useEffect(() => {
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
          setIsStreaming(true);
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    };

    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
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
    if (!videoRef.current || !canvasRef.current || !isStreaming) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const video = videoRef.current;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const centerX = Math.floor(canvas.width / 2);
    const centerY = Math.floor(canvas.height / 2);
    const radius = 70;
    
    context.strokeStyle = 'red';
    context.lineWidth = 2;
    context.strokeRect(
      centerX - radius,
      centerY - radius * 1.5,
      radius * 2,
      radius * 3
    );

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

    requestAnimationFrame(analyzeFrame);
  };

  useEffect(() => {
    if (isStreaming) {
      analyzeFrame();
    }
  }, [isStreaming]);

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

  // New function to capture current color
  const captureColor = () => {
    const colorName = getColorName(dominantColor.r, dominantColor.g, dominantColor.b);
    const capturedColor = {
      ...dominantColor,
      name: colorName,
      timestamp: new Date().toLocaleTimeString(),
    };
    setCapturedColors(prev => [...prev, capturedColor]);
  };

  const colorName = getColorName(dominantColor.r, dominantColor.g, dominantColor.b);
  const rgbString = `rgb(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b})`;

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
          <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
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
          </div>
          
          <div className="flex items-center justify-center">
            <Button 
              onClick={captureColor}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Capturar
            </Button>
          </div>

          {capturedColors.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Colores Capturados</h3>
              <div className="grid grid-cols-2 gap-3">
                {capturedColors.map((color, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div
                      className="w-12 h-12 rounded-lg shadow-inner"
                      style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
                    />
                    <div>
                      <p className="font-medium">{color.name}</p>
                      <p className="text-sm text-gray-500">
                        rgb({color.r}, {color.g}, {color.b})
                      </p>
                      <p className="text-xs text-gray-400">{color.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ColorDetector;