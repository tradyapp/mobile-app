import { useCallback } from "react";
import { ScreenHeader } from "./shared";
import TemplateGridView from "./TemplateGridView";
import { type DrawingTemplate, type DrawingTemplateCategory } from "@/stores/drawingTemplateStore";
import { useDrawingStore } from "@/stores/drawingStore";

interface TemplatesScreenProps {
  category: DrawingTemplateCategory;
  drawingId: string;
  onBack: () => void;
  onClose: () => void;
  onCreateNew: () => void;
  onEditTemplate: (template: DrawingTemplate) => void;
}

export default function TemplatesScreen({
  category,
  drawingId,
  onBack,
  onClose,
  onCreateNew,
  onEditTemplate,
}: TemplatesScreenProps) {
  const updateDrawingStyle = useDrawingStore(s => s.updateDrawingStyle);

  const applyTemplate = useCallback((template: DrawingTemplate) => {
    const style: Record<string, unknown> = {
      color: template.color,
      opacity: template.opacity,
    };
    if (template.category === 'line') {
      style.strokeWidth = template.strokeWidth;
      style.strokeDash = template.strokeDash;
    } else if (template.category === 'shape') {
      style.strokeWidth = template.strokeWidth;
      style.strokeDash = template.strokeDash;
      style.fill = template.fill;
    } else if (template.category === 'text') {
      style.fontSize = template.fontSize;
      style.textHAlign = template.textHAlign;
      style.textVAlign = template.textVAlign;
    }
    updateDrawingStyle(drawingId, style);
  }, [drawingId, updateDrawingStyle]);

  return (
    <>
      <ScreenHeader onBack={onBack} onClose={onClose} title="Style Templates" />
      <TemplateGridView
        category={category}
        onSelect={applyTemplate}
        onCreateNew={onCreateNew}
        onEditTemplate={onEditTemplate}
      />
    </>
  );
}
