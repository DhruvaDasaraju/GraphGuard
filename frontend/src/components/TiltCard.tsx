import { useState, useRef, type ReactNode, type CSSProperties } from 'react';


interface TiltCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  maxTilt?: number;
  chamfer?: boolean;
}

export function TiltCard({
  children,
  className = '',
  style = {},
  onClick,
  maxTilt = 8,
  chamfer = true,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState<string>('perspective(800px) rotateX(0deg) rotateY(0deg)');
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    const rotateX = -y * maxTilt * 2;
    const rotateY = x * maxTilt * 2;

    setTransform(`perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-3px)`);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTransform('perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px)');
  };

  const chamferClip = chamfer
    ? 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))'
    : undefined;

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transform,
        transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.25s ease-out',
        clipPath: style.clipPath || chamferClip,
        ...style,
      }}
      className={`will-change-transform ${className}`}
    >
      {children}
    </div>
  );
}
