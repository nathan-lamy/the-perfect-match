import { Check } from "lucide-react";

interface StepProgressProps {
  steps: string[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
}

export function StepProgress({
  steps,
  currentStep,
  onStepClick,
}: StepProgressProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <button
                onClick={() => onStepClick?.(index)}
                disabled={!onStepClick}
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  index < currentStep
                    ? "bg-primary border-primary text-primary-foreground"
                    : index === currentStep
                    ? "border-primary text-primary"
                    : "border-muted text-muted-foreground"
                } ${
                  onStepClick
                    ? "hover:scale-110 hover:shadow-lg cursor-pointer active:scale-95"
                    : ""
                } disabled:cursor-default`}
              >
                {index < currentStep ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-semibold">{index}</span>
                )}
              </button>
              <span
                className={`mt-2 text-xs text-center ${
                  index === currentStep
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {step}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 transition-colors ${
                  index < currentStep ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
