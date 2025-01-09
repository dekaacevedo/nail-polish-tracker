import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, ImageIcon, Loader } from 'lucide-react';
import { NAILPOLISH } from '../consts/nail-polish';
import { calculateImageSimilarity } from '../utils/imageProcessing';

const PROCESSING_TIMEOUT = 10000; // 10 seconds maximum processing time
const SIMILARITY_THRESHOLD = 0.70; // Reducido para manejar variaciones de WebP

const listOfNailPolish = NAILPOLISH.map(nailpolish => ({ ...nailpolish }));

const NailPolishFinder = () => {
  const [imagePreview, setImagePreview] = useState(null);
  const [debugImage, setDebugImage] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const processingTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeCamera = async () => {
      if (showCamera && videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });

          if (mounted && videoRef.current) {
            streamRef.current = stream;
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setIsCameraReady(true);
            setError(null);
          }
        } catch (err) {
          console.error('Error initializing camera:', err);
          if (mounted) {
            setError('No se pudo acceder a la cámara. ' + err.message);
            setShowCamera(false);
          }
        }
      }
    };

    if (showCamera) {
      initializeCamera();
    }

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [showCamera]);

  const processImage = async (imageData) => {
    setIsProcessing(true);
    setError(null);
    setSearchResult(null);
    setDebugImage(null);
    
    processingTimeoutRef.current = setTimeout(() => {
      setIsProcessing(false);
      setError('El proceso está tomando demasiado tiempo. Por favor, intenta de nuevo.');
    }, PROCESSING_TIMEOUT);
    
    try {
      let bestMatch = null;
      let highestSimilarity = 0;
      
      console.log('Iniciando búsqueda de coincidencias...');
      console.log(`Número total de esmaltes a comparar: ${listOfNailPolish.length}`);
      
      for (const polish of listOfNailPolish) {
        try {
          const { similarity, debugImageUrl } = await calculateImageSimilarity(imageData, polish.id);
          if (!debugImage) {
            setDebugImage(debugImageUrl);
          }
          console.log(`${polish.name} (${polish.id}): ${(similarity * 100).toFixed(1)}%`);
          
          if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            bestMatch = polish;
          }
        } catch (err) {
          console.error(`Error procesando esmalte ${polish.id}:`, err);
        }
      }
      
      console.log(`Mejor coincidencia: ${bestMatch?.name || 'Ninguna'} con ${(highestSimilarity * 100).toFixed(1)}%`);
      
      clearTimeout(processingTimeoutRef.current);
      setSearchResult({
        found: highestSimilarity > SIMILARITY_THRESHOLD,
        similarity: highestSimilarity,
        ...bestMatch
      });
    } catch (error) {
      console.error('Error processing image:', error);
      setError('Error al procesar la imagen. Por favor, intenta de nuevo.');
    } finally {
      setIsProcessing(false);
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    }
  };

  const startCamera = () => {
    setError(null);
    setShowCamera(true);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
    setIsCameraReady(false);
  };

  const captureImage = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg');
      setImagePreview(imageData);
      stopCamera();
      processImage(imageData);
    } catch (err) {
      console.error('Error capturing image:', err);
      setError('Error al capturar la imagen. Por favor, intenta de nuevo.');
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target.result);
          processImage(e.target.result);
        };
        reader.onerror = () => {
          setError('Error al leer la imagen. Por favor, intenta con otra imagen.');
        };
        reader.readAsDataURL(file);
      } else {
        setError('Por favor, selecciona un archivo de imagen válido.');
      }
    }
  };

  const resetSearch = () => {
    setImagePreview(null);
    setDebugImage(null);
    setSearchResult(null);
    setError(null);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-4">
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 p-4 rounded">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {!showCamera && !imagePreview && (
        <div className="space-y-4">
          <button
            onClick={startCamera}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            disabled={isProcessing}
          >
            <Camera className="w-6 h-6" />
            Tomar Foto del Esmalte
          </button>
          
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="hidden"
              id="file-upload"
              disabled={isProcessing}
            />
            <label
              htmlFor="file-upload"
              className={`w-full bg-gray-600 hover:bg-gray-700 text-white p-4 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                isProcessing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <ImageIcon className="w-6 h-6" />
              Subir Imagen
            </label>
          </div>
        </div>
      )}

      {showCamera && (
        <div className="relative">
          <div className="min-h-[200px] bg-gray-100 rounded-lg">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full rounded-lg object-cover"
              muted
            />
            {!isCameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-90 rounded-lg">
                <Loader className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            )}
          </div>
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
            <button
              onClick={captureImage}
              className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full transition-colors disabled:opacity-50"
              disabled={!isCameraReady || isProcessing}
            >
              <Camera className="w-6 h-6" />
            </button>
            <button
              onClick={stopCamera}
              className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {imagePreview && (
        <div className="space-y-4 mb-10">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Imagen capturada"
              className="w-full rounded-lg"
            />
            <button
              onClick={resetSearch}
              className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full transition-colors"
              disabled={isProcessing}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {debugImage && (
            <div className="relative mt-4">
              <p className="text-sm text-gray-600 mb-2">Área analizada:</p>
              <img
                src={debugImage}
                alt="Área analizada"
                className="w-full rounded-lg border-2 border-green-500"
              />
            </div>
          )}

          {isProcessing && (
            <div className="bg-blue-100 border-l-4 border-blue-500 p-4 rounded flex items-center gap-3">
              <Loader className="w-5 h-5 animate-spin" />
              <div>
                <p className="font-bold">Procesando imagen...</p>
                <p>Comparando con tu colección de esmaltes...</p>
              </div>
            </div>
          )}

          {!isProcessing && searchResult && (
            <div className={`border-l-4 p-4 rounded ${
              searchResult.found 
                ? "bg-yellow-100 border-yellow-500" 
                : "bg-green-100 border-green-500"
            }`}>
              <p className="font-bold">
                {searchResult.found ? "¡Ya tienes este esmalte!" : "Esmalte no encontrado"}
              </p>
              {searchResult.found && (
                <div className="mt-2 space-y-1">
                  <p>Nombre: {searchResult.name}</p>
                  <p>Marca: {searchResult.brand}</p>
                  <p>Característica: {searchResult.feature}</p>
                  <p>Colección: {searchResult.collection || 'N/A'}</p>
                  <p>Nivel: {searchResult.level}</p>
                  <div className="flex items-center gap-2">
                    <span>Color:</span>
                    <div 
                      className="w-6 h-6 rounded-full border border-gray-300" 
                      style={{ backgroundColor: searchResult.color }}
                    />
                  </div>
                </div>
              )}
              {!searchResult.found && (
                <p>Este esmalte no está en tu colección. ¡Puedes comprarlo!</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NailPolishFinder;