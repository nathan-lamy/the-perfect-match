"use client";

import { useState } from "react";
import { StepProgress } from "@/components/step-progress";
import { Step0Students } from "@/components/steps/step-0-students";
import { Step1PastColles } from "@/components/steps/step-1-past-colles";
import { Step2FetchSlots } from "@/components/steps/step-2-fetch-slots";
import { Step3Pipeline } from "@/components/steps/step-3-pipeline";
import { Step4Compute } from "@/components/steps/step-4-compute";
import { Step5Publish } from "@/components/steps/step-5-publish";
import { Button } from "@/components/ui/button";

export function StepManager() {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    "Élèves",
    "Colles passées",
    "Créneaux",
    "Pipeline",
    "Calcul",
    "Publication",
  ];

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <Step0Students
            onNext={() => setCurrentStep(1)}
          />
        );
      case 1:
        return (
          <Step1PastColles
            onNext={() => setCurrentStep(2)}
            onSkip={() => setCurrentStep(2)}
          />
        );
      case 2:
        return (
          <Step2FetchSlots
            onNext={() => setCurrentStep(3)}
            onSkip={() => setCurrentStep(3)}
          />
        );
      case 3:
        return (
          <Step3Pipeline
            onNext={() => setCurrentStep(4)}
          />
        );
      case 4:
        return (
          <Step4Compute
            onNext={() => setCurrentStep(5)}
          />
        );
      case 5:
        return <Step5Publish onComplete={() => setCurrentStep(0)} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">The Perfect Match 🗓️</h1>
            {currentStep !== 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep(0)}
              >
                Retour aux élèves
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <StepProgress
          steps={steps}
          currentStep={currentStep}
          onStepClick={setCurrentStep}
        />
        <div className="mt-8">{renderStep()}</div>
      </div>
    </div>
  );
}
