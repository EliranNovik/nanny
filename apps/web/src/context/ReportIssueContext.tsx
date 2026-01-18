import React, { createContext, useContext, useState, ReactNode } from "react";

interface ReportIssueContextType {
  openReportModal: () => void;
  closeReportModal: () => void;
  isOpen: boolean;
}

const ReportIssueContext = createContext<ReportIssueContextType | null>(null);

export function ReportIssueProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openReportModal = () => setIsOpen(true);
  const closeReportModal = () => setIsOpen(false);

  return (
    <ReportIssueContext.Provider value={{ openReportModal, closeReportModal, isOpen }}>
      {children}
    </ReportIssueContext.Provider>
  );
}

export function useReportIssue() {
  const context = useContext(ReportIssueContext);
  if (!context) {
    throw new Error("useReportIssue must be used within ReportIssueProvider");
  }
  return context;
}

