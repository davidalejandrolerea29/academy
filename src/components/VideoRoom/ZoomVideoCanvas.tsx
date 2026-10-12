// Component to render Zoom video streams using canvas
import React, { useEffect, useRef } from 'react';
import { getZoomVideoSDKService } from '../../services/ZoomVideoSDKService';
import { VideoQuality } from '@zoom/videosdk';

interface ZoomVideoCanvasProps {
    userId: number;
    width?: number;
    height?: number;
    quality?: VideoQuality;
    className?: string;
    isScreenShare?: boolean;
}

export const ZoomVideoCanvas: React.FC<ZoomVideoCanvasProps> = ({
    userId,
    width = 640,
    height = 360,
    quality = VideoQuality.Video_360P,
    className = '',
    isScreenShare = false,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const zoomService = getZoomVideoSDKService();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let isRendering = false;

        const startRendering = async () => {
            try {
                if (isRendering) return;

                await zoomService.renderVideo(
                    canvas,
                    userId,
                    width,
                    height,
                    quality
                );

                isRendering = true;
                console.log(`[ZoomVideoCanvas] Started rendering video for user ${userId}`);
            } catch (error) {
                console.error(`[ZoomVideoCanvas] Error rendering video for user ${userId}:`, error);
            }
        };

        const stopRendering = async () => {
            try {
                if (!isRendering) return;

                await zoomService.stopRenderVideo(canvas, userId);
                isRendering = false;
                console.log(`[ZoomVideoCanvas] Stopped rendering video for user ${userId}`);
            } catch (error) {
                console.error(`[ZoomVideoCanvas] Error stopping video for user ${userId}:`, error);
            }
        };

        startRendering();

        return () => {
            stopRendering();
        };
    }, [userId, width, height, quality, zoomService]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className={className}
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
            }}
        />
    );
};

export default ZoomVideoCanvas;
