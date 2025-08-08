/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useRef, useCallback } from "react";
import { Upload, X, RotateCcw, Check, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme, themes } from "@/components/theme/ThemeProvider";
import { useToast } from "@/components/ui/toast-context";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import type { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";

interface AvatarUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onAvatarUpdate: (file: File) => Promise<void>;
  currentAvatarUrl?: string;
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  isOpen,
  onClose,
  onAvatarUpdate,
}) => {
  const { theme } = useTheme();
  const currentTheme = themes[theme];
  const { showToast } = useToast();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Функция для создания начального кропа (квадратный, по центру)
  const centerAspectCrop = useCallback(
    (mediaWidth: number, mediaHeight: number) => {
      return centerCrop(
        makeAspectCrop(
          {
            unit: "%",
            width: 90,
          },
          1, // aspect ratio 1:1 для квадратного аватара
          mediaWidth,
          mediaHeight,
        ),
        mediaWidth,
        mediaHeight,
      );
    },
    [],
  );

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast({
        variant: "destructive",
        title: "Ошибка",
        description: "Пожалуйста, выберите изображение",
        icon: "alertCircle",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB
      showToast({
        variant: "destructive",
        title: "Ошибка",
        description: "Размер файла не должен превышать 5MB",
        icon: "alertCircle",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      setCrop(centerAspectCrop(width, height));
    },
    [centerAspectCrop],
  );

  const getCroppedImg = useCallback(async (): Promise<File | null> => {
    if (!completedCrop || !imgRef.current) return null;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const image = imgRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height,
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
            resolve(file);
          } else {
            resolve(null);
          }
        },
        "image/jpeg",
        0.9,
      );
    });
  }, [completedCrop]);

  const handleUpload = async () => {
    if (!completedCrop) {
      showToast({
        variant: "destructive",
        title: "Ошибка",
        description: "Пожалуйста, выберите область для обрезки",
        icon: "alertCircle",
      });
      return;
    }

    setIsUploading(true);
    try {
      const croppedFile = await getCroppedImg();
      if (croppedFile) {
        await onAvatarUpdate(croppedFile);
        handleClose();
      }
    } catch {
      showToast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось загрузить аватар",
        icon: "alertCircle",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedImage(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setIsDragOver(false);
    onClose();
  };

  const resetImage = () => {
    setSelectedImage(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent
        className={`${currentTheme.avatarCard} ${currentTheme.border} max-w-3xl max-h-[90vh] overflow-y-auto`}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className={`${currentTheme.text} flex items-center gap-2`}
          >
            <Camera className="h-5 w-5" />
            Изменить аватар
          </AlertDialogTitle>
          <AlertDialogDescription className={currentTheme.text}>
            Загрузите новое изображение и настройте его для своего аватара
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {!selectedImage ? (
            // Область загрузки файла
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${
                  isDragOver
                    ? "border-primary bg-primary/10"
                    : `${currentTheme.border} hover:border-primary/50`
                }
              `}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload
                className={`mx-auto h-12 w-12 ${currentTheme.text} mb-4`}
              />
              <h3 className={`${currentTheme.text} text-lg font-semibold mb-2`}>
                Перетащите изображение сюда
              </h3>
              <p className={`${currentTheme.text} mb-4`}>
                или нажмите для выбора файла
              </p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="mb-2"
              >
                Выбрать файл
              </Button>
              <p className={`${currentTheme.text} text-xs`}>
                Поддерживаются: JPG, PNG, GIF (до 5MB)
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                className="hidden"
              />
            </div>
          ) : (
            // Область редактирования изображения
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className={`${currentTheme.text} font-semibold`}>
                  Настройте ваш аватар
                </h3>
                <Button variant="outline" size="sm" onClick={resetImage}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Выбрать другое
                </Button>
              </div>

              <div className="flex justify-center rounded-lg border bg-gray-50 dark:bg-gray-900">
                <div className="max-w-full max-h-96 overflow-auto">
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={1}
                    minWidth={50}
                    minHeight={50}
                    keepSelection
                    className="max-w-none"
                  >
                    <img
                      ref={imgRef}
                      src={selectedImage}
                      alt="Crop preview"
                      onLoad={onImageLoad}
                      style={{
                        maxWidth: "min(500px, 90vw)",
                        maxHeight: "400px",
                        width: "auto",
                        height: "auto",
                        display: "block",
                      }}
                    />
                  </ReactCrop>
                </div>
              </div>

              <div className="space-y-2">
                <p className={`${currentTheme.text} text-sm text-center`}>
                  Перетащите рамку или измените её размер для обрезки
                  изображения
                </p>
                <p className={`${currentTheme.text} text-xs text-center`}>
                  Используйте прокрутку, если изображение не помещается
                  полностью
                </p>
              </div>
            </div>
          )}
        </div>

        <AlertDialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            <X className="h-4 w-4 mr-2" />
            Отмена
          </Button>

          {selectedImage && (
            <Button
              onClick={handleUpload}
              disabled={!completedCrop || isUploading}
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Сохранить аватар
                </>
              )}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AvatarUpload;
