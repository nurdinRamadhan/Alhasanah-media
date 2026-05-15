import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";

/**
 * Utilitas Laporan PDF Profesional
 * Menghasilkan PDF berbasis teks (Native), bukan Screenshot/HTML2Canvas.
 * Hasil: Teks tajam, bisa di-copy, file kecil, kualitas premium.
 */

const GOLD = "#C9A84C";
const GOLD_DEEP = "#8B6914";

const santriAlias = (nis?: string | null) => {
  const safe = String(nis || "").replace(/[^0-9A-Za-z]/g, "");
  return `Santri-${safe.slice(-4) || "XXXX"}`;
};

export const exportSantriToPdf = (data: any[], filterDesc: string = "") => {
  const doc = new jsPDF("l", "mm", "a4"); // Landscape
  const dateStr = dayjs().format("DD/MM/YYYY HH:mm");

  // 1. Header Al-Hasanah Premium
  doc.setFillColor(253, 246, 220); // Light Gold BG
  doc.rect(0, 0, 297, 40, "F");

  // Gold Line
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(1);
  doc.line(0, 40, 297, 40);

  // Text Header
  doc.setTextColor(92, 67, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("PONDOK PESANTREN AL-HASANAH", 148.5, 18, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(107, 95, 80);
  doc.text("Jl. Raya Cibeuti No.13, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182", 148.5, 25, { align: "center" });
  doc.text("Email: admin@alhasanah.id | Website: alhasanah.id", 148.5, 30, { align: "center" });

  // 2. Judul Laporan
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("LAPORAN RINGKAS SANTRI", 14, 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Dicetak pada: ${dateStr} WIB`, 14, 58);
  if (filterDesc) {
    doc.text(`Filter Aktif: ${filterDesc}`, 14, 63);
  }

  // 3. Table Data
  const tableData = data.map((item, index) => [
    index + 1,
    item.nis,
    santriAlias(item.nis),
    item.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan",
    item.jurusan || "-",
    `Kelas ${item.kelas}`,
    item.status_santri
  ]);

  autoTable(doc, {
    startY: 70,
    head: [["NO", "NIS", "ALIAS", "JK", "TAKHASUS", "KELAS", "STATUS"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [201, 168, 76],
      textColor: 255,
      fontSize: 10,
      fontStyle: "bold",
      halign: "center"
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { halign: "center", cellWidth: 25 },
      2: { fontStyle: "bold" },
      3: { halign: "center" },
      5: { halign: "center" },
      6: { halign: "center" },
      7: { halign: "center" },
    },
    didDrawPage: (data) => {
      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Halaman ${data.pageNumber} dari Pondok Pesantren Al-Hasanah`,
        14,
        doc.internal.pageSize.height - 10
      );
    }
  });

  doc.save(`Laporan_Santri_${dayjs().format("YYYYMMDD_HHmm")}.pdf`);
};
