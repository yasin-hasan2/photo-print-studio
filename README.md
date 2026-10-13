# 📸 Offline Photo Print Studio

**A simple, offline-friendly photo printing application built with HTML, CSS, and Vanilla JavaScript.**

Offline Photo Print Studio helps users arrange multiple photos on a printable page, customize photo dimensions and spacing, preview the layout, and export print-ready PDF files.

## ✨ Features

- **Offline-friendly:** Runs locally in your browser without requiring a backend server.
- **Photo Upload:** Upload and manage multiple photos.
- **Photo Presets:** Select passport photo dimensions or enter custom dimensions.
- **Multiple Copies:** Set the number of copies for each photo.
- **Paper Sizes:** Choose A4, 4R, 5R, 6R, or custom paper dimensions.
- **Custom Margins:** Independently configure top, bottom, left, and right margins.
- **Adjustable Spacing:** Control the distance between photos.
- **Maximum Photos Per Row:** Set the maximum number of photos in each row.
- **Cutting Guides:** Enable or disable dashed cutting guides and adjust their spacing.
- **Live Preview:** Preview the photo layout before printing.
- **Multi-page Layout:** Automatically arrange photos across multiple pages.
- **PDF Export:** Generate a PDF using jsPDF.
- **Browser Printing:** Print the arranged pages directly from your browser.
- **Project Save and Load:** Save project settings and photo data in a JSON project file and load them later.
- **Zoom Controls:** Zoom in and out of the preview.
- **Responsive Interface:** Use the application on different screen sizes.

## 🛠️ Technology Stack

| Technology         | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| HTML5              | Application structure                            |
| CSS3               | Styling, layout, and print styles                |
| Vanilla JavaScript | Photo processing and layout calculations         |
| jsPDF              | PDF generation                                   |
| FileReader API     | Reading uploaded images                          |
| Canvas API         | Potential image processing and format conversion |
| IndexedDB          | Local browser storage for photo data             |

## 📂 Project Structure

```text
Offline-Photo-Print-Studio/
├── index.html
├── README.md
├── css/
│   ├── style.css
│   └── print.css
├── js/
│   └── app.js
└── lib/
    └── jspdf.umd.min.js
```

### File Descriptions

- `index.html`: Main application interface and controls.
- `css/style.css`: Main interface styling and preview layout.
- `css/print.css`: Print-specific styles and page formatting.
- `js/app.js`: Photo management, layout calculations, preview, PDF export, and project handling.
- `lib/jspdf.umd.min.js`: Local jsPDF library used to generate PDFs.
- `README.md`: Project documentation.

## 🚀 Getting Started

### Prerequisites

You need:

- A modern web browser such as Google Chrome, Microsoft Edge, or Firefox.
- A code editor such as Visual Studio Code, if you want to modify the source code.

No Node.js installation or package manager is required for the current vanilla JavaScript setup.

### 1. Download or Clone the Project

If the project is hosted on GitHub, clone it using:

```bash
git clone YOUR_REPOSITORY_URL
```

Alternatively, download the repository as a ZIP file and extract it.

### 2. Open the Project

Open the project folder in Visual Studio Code.

Make sure the jsPDF library is available at:

```text
lib/jspdf.umd.min.js
```

### 3. Run the Application

Open `index.html` in your browser.

For a more reliable development experience, you can use the **Live Server** extension in Visual Studio Code:

1. Open the project folder.
2. Right-click `index.html`.
3. Select **Open with Live Server**.

The application is designed to work locally. However, the jsPDF library must be present, and any external resources or browser-dependent features must be available for the relevant functionality to work offline.

## 📖 How to Use

1. Open Offline Photo Print Studio.
2. Upload one or more photos.
3. Select a photo preset or enter custom photo dimensions in millimeters.
4. Set the number of copies required.
5. Choose a paper size or specify custom paper dimensions.
6. Adjust the top, bottom, left, and right margins.
7. Configure photo spacing and the maximum number of photos per row.
8. Enable cutting guides and adjust their spacing if needed.
9. Generate and review the print preview.
10. Export the layout as a PDF or use the browser's print option.

**Tip:** For accurate physical dimensions, print the PDF at **Actual Size** or **100% scale**. Avoid options such as _Fit to page_ if they would resize the output.

## 📐 Measurement Settings

All photo, paper, margin, spacing, and cutting-guide measurements are configured in millimeters (mm).

| Setting                | Default |
| ---------------------- | ------: |
| Top margin             |   10 mm |
| Bottom margin          |   10 mm |
| Left margin            |   10 mm |
| Right margin           |   10 mm |
| Photo spacing          |    3 mm |
| Maximum photos per row |       5 |
| Cutting guides         | Enabled |
| Cutting-guide spacing  |    2 mm |

These are the application's default settings and can be adjusted from the interface.

## 🖨️ PDF Export and Printing

The application uses jsPDF to create PDF documents containing the arranged photos and optional cutting guides.

For best results:

- Confirm the selected paper size before exporting.
- Check that the photos fit within the printable area.
- Use the correct paper size in your printer settings.
- Print at 100% scale when physical dimensions matter.
- Print a test page before printing a large batch.

**Note:** Browser printing can handle page sizes differently across browsers and printer drivers. Verify custom paper sizes and multi-page layouts before relying on them for production printing. PDF export is the preferred option when you need to preserve a specifically configured page size.

## 💾 Local Data and Privacy

The application is designed to process photos locally in the browser.

- Uploaded photos can be used to create the print layout.
- IndexedDB can store photo data locally in the browser.
- Project files can be saved as JSON and loaded again.
- No backend server or user account is required for the current design.

Local browser storage is device- and browser-specific. Clearing browser data may remove locally stored information. Keep exported project files as backups.

## 🔒 Offline Support

The application can run without a remote backend when its HTML, CSS, JavaScript, and jsPDF files are available locally.

For fully offline use:

- Keep the jsPDF library inside the `lib` directory.
- Avoid dependencies on remote scripts, fonts, or image services.
- Test photo upload, preview, PDF export, and printing with the internet disconnected.

A service worker is not currently included in this project structure, so automatic installation as a Progressive Web App (PWA) is not part of the current implementation.

## 🗺️ Future Improvements

Potential future enhancements include:

- Drag-and-drop photo arrangement.
- Automatic photo cropping and positioning.
- Additional passport and ID photo presets.
- Image rotation and brightness adjustments.
- More paper sizes and configurable page orientation.
- Persistent restoration of previous sessions.
- PWA support for installable offline use.
- Keyboard shortcuts and accessibility improvements.
- Automated tests for layout calculations and PDF output.

## 🤝 Contributing

Contributions, suggestions, and bug reports are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Test the application in a modern browser.
5. Submit a pull request describing your changes.

## 🐛 Reporting Issues

If you find a bug or have a feature request, open an issue in the project's GitHub repository. Include steps to reproduce the problem and details about your browser when relevant.

## 📄 License

No license has been specified yet. Add an appropriate `LICENSE` file before distributing the project under an open-source license.

## 👨‍💻 Author

**Yasin Al Hasan**

Built to make everyday photo layout and printing tasks simpler, more flexible, and accessible offline.

---

⭐ If you find this project useful, consider giving the repository a star on GitHub.
