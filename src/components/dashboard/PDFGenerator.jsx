'use client';
import { jsPDF } from 'jspdf';
import { Button } from '../ui';
import { FileDown } from 'lucide-react';

export default function PDFGenerator({ menu }) {
  // Función para cargar imagen y convertir a base64
  const loadImage = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  const generatePDF = async () => {
    const doc = new jsPDF();
    let yPosition = 20;

    // Header
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(menu.name, 20, yPosition);
    yPosition += 10;

    if (menu.description) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(menu.description, 20, yPosition);
      yPosition += 10;
    }

    yPosition += 5;

    // Sections
    const activeSections = menu.sections.filter(section => section.isActive);
    
    for (const section of activeSections) {
      // Check if we need a new page
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }

      // Section Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(section.name, 20, yPosition);
      yPosition += 8;

      if (section.description) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text(section.description, 20, yPosition);
        yPosition += 6;
      }

      // Dishes
      for (const dish of section.items.filter(item => item.isActive)) {
          const imageHeight = dish.image ? 25 : 0;
          const dishHeight = imageHeight + 20; // Espacio estimado para el plato completo

          if (yPosition + dishHeight > 270) {
            doc.addPage();
            yPosition = 20;
          }

          let currentY = yPosition;

          // Imagen del plato (si existe)
          if (dish.image) {
            try {
              const img = await loadImage(dish.image);
              const imgWidth = 30;
              const imgHeight = 25;
              
              // Crear canvas para convertir imagen
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              const imgData = canvas.toDataURL('image/jpeg', 0.8);
              
              doc.addImage(imgData, 'JPEG', 25, currentY, imgWidth, imgHeight);
              
              // Ajustar posición del texto para que esté al lado de la imagen
              doc.setFontSize(12);
              doc.setFont('helvetica', 'bold');
              doc.text(dish.name, 58, currentY + 5);

              // Price al lado del nombre
              doc.setFont('helvetica', 'normal');
              const priceText = `$${dish.price.toFixed(2)}`;
              const priceWidth = doc.getTextWidth(priceText);
              doc.text(priceText, 190 - priceWidth, currentY + 5);

              currentY += 10;

              // Description debajo del nombre
              if (dish.description) {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                const splitDescription = doc.splitTextToSize(dish.description, 130);
                doc.text(splitDescription, 58, currentY);
                currentY += Math.max(splitDescription.length * 3.5, imgHeight - 10);
              } else {
                currentY += imgHeight - 10;
              }

              // Discount
              if (dish.discount > 0) {
                doc.setFontSize(8);
                doc.setTextColor(220, 38, 38);
                doc.text(`-${dish.discount}% descuento`, 58, currentY);
                doc.setTextColor(0, 0, 0);
                currentY += 4;
              }

              yPosition = currentY + 6;

            } catch (error) {
              console.error('Error loading image:', error);
              // Si falla la carga de imagen, mostrar solo texto
              doc.setFontSize(12);
              doc.setFont('helvetica', 'bold');
              doc.text(dish.name, 25, yPosition);

              doc.setFont('helvetica', 'normal');
              const priceText = `$${dish.price.toFixed(2)}`;
              const priceWidth = doc.getTextWidth(priceText);
              doc.text(priceText, 190 - priceWidth, yPosition);

              yPosition += 5;

              if (dish.description) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                const splitDescription = doc.splitTextToSize(dish.description, 150);
                doc.text(splitDescription, 25, yPosition);
                yPosition += splitDescription.length * 4;
              }

              if (dish.discount > 0) {
                doc.setFontSize(9);
                doc.setTextColor(220, 38, 38);
                doc.text(`-${dish.discount}% descuento`, 25, yPosition);
                doc.setTextColor(0, 0, 0);
                yPosition += 4;
              }

              yPosition += 4;
            }
          } else {
            // Sin imagen, usar el formato original
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(dish.name, 25, yPosition);

            // Price
            doc.setFont('helvetica', 'normal');
            const priceText = `$${dish.price.toFixed(2)}`;
            const priceWidth = doc.getTextWidth(priceText);
            doc.text(priceText, 190 - priceWidth, yPosition);

            yPosition += 5;

            // Description
            if (dish.description) {
              doc.setFontSize(10);
              doc.setFont('helvetica', 'normal');
              const splitDescription = doc.splitTextToSize(dish.description, 150);
              doc.text(splitDescription, 25, yPosition);
              yPosition += splitDescription.length * 4;
            }

            // Discount
            if (dish.discount > 0) {
              doc.setFontSize(9);
              doc.setTextColor(220, 38, 38);
              doc.text(`-${dish.discount}% descuento`, 25, yPosition);
              doc.setTextColor(0, 0, 0);
              yPosition += 4;
            }

            yPosition += 4;
          }
        }

        yPosition += 5;
      }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Página ${i} de ${pageCount}`, 180, 287);
    }

    // Download
    doc.save(`${menu.name.replace(/\s+/g, '_')}_menu.pdf`);
  };

  return (
    <Button variant="outline" onClick={generatePDF}>
      <FileDown size={18} className="inline mr-2" />
      Descargar PDF
    </Button>
  );
}
