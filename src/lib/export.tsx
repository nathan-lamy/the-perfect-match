import * as XLSX from "xlsx";
import { writeFile } from "@tauri-apps/plugin-fs";
import { save } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import type { Assignment, Student, FutureSlot } from "@/types";

interface Props {
  assignments: Assignment[];
  students: Student[];
  slots: FutureSlot[];
  title?: string;
  filename?: string;
}

export const DownloadTimetableButton = ({
  assignments,
  students,
  slots,
  title = "Download Timetable",
  filename = "timetable.xlsx",
}: Props) => {
  const handleDownload = async () => {
    try {
      // Ask user where to save the file
      const filePath = await save({
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
        defaultPath: filename,
      });

      if (!filePath) return; // user cancelled

      // Build timetable data
      const data = assignments.map((a) => {
        const student = students.find((s) => s.id === a.studentId);
        const slot = slots.find((s) => s.id === a.slotId);
        return {
          "Student ID": student?.id || "",
          "Student Name": student?.name || "",
          Teacher: slot?.teacher || "Unassigned",
          Date: slot?.date || "",
          "Start Time": slot?.start_hour || "",
          "End Time": slot?.end_hour || "",
          Subject: slot?.subject || "",
        };
      });

      // Convert to worksheet and workbook
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Timetable");

      // Write Excel to buffer as Uint8Array
      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      // Convert to Uint8Array if needed
      const uint8Array = new Uint8Array(excelBuffer);

      // Save using Tauri's file API
      await writeFile(filePath, uint8Array);

      console.log("✅ Timetable saved:", filePath);
    } catch (err) {
      console.error("❌ Failed to save timetable:", err);
    }
  };

  return <Button onClick={handleDownload}>{title}</Button>;
};
