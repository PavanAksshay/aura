import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

PDF_PATH = "/Users/pavanaksshay/aura/Aura_Client_Installation_and_Handoff_Guide.pdf"

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "Aura — Client Installation & Software Handoff Guide")
            self.drawRightString(612 - 54, 750, "Confidential & Proprietary")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(54, 742, 612 - 54, 742)
        
        # Footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(612 - 54, 36, page_text)
        self.drawString(54, 36, "Aura Clinical Scribe Workspace © 2026")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 48, 612 - 54, 48)
        
        self.restoreState()

def build_pdf():
    doc = SimpleDocTemplate(
        PDF_PATH,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    c_primary = colors.HexColor("#0F172A")    # Slate 900
    c_accent = colors.HexColor("#2563EB")     # Blue 600
    c_secondary = colors.HexColor("#475569")  # Slate 600
    c_bg_light = colors.HexColor("#F8FAFC")   # Slate 50
    c_border = colors.HexColor("#CBD5E1")     # Slate 300
    c_success = colors.HexColor("#16A34A")    # Green 600
    c_alert_bg = colors.HexColor("#EFF6FF")   # Blue 50
    c_warn_bg = colors.HexColor("#FEF3C7")    # Amber 50
    
    # Custom Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=c_primary,
        spaceAfter=5
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=c_secondary,
        spaceAfter=12
    )
    
    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=c_primary,
        spaceBefore=12,
        spaceAfter=5,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=c_accent,
        spaceBefore=9,
        spaceAfter=3,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    )

    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#0F172A"),
        backColor=colors.HexColor("#F1F5F9"),
        borderColor=colors.HexColor("#E2E8F0"),
        borderWidth=0.5,
        borderPadding=4,
        spaceBefore=3,
        spaceAfter=5
    )

    callout_style = ParagraphStyle(
        'Callout_Text',
        parent=body_style,
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#1E3A8A")
    )

    story = []

    # Title Banner
    story.append(Paragraph("Aura — Client Installation & Deployment Playbook", title_style))
    story.append(Paragraph("Commercial handoff guide: Zero-source-code distribution via pre-built Docker containers", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_accent, spaceBefore=0, spaceAfter=10))

    # Executive Overview
    overview_text = (
        "<b>IP Protection & Architecture:</b> When licensing Aura to a client or clinic, you <b>never transfer your source code repository</b>. "
        "Instead, pre-compiled Docker images are pushed to a container registry (Docker Hub / GitHub Packages). "
        "The client only receives two files: <code>docker-compose.yml</code> and <code>.env</code>. "
        "All AI processing (Whisper large-v3, pyannote, Ollama) runs 100% locally on the client's machine."
    )
    
    callout_data = [[Paragraph(overview_text, callout_style)]]
    callout_table = Table(callout_data, colWidths=[504])
    callout_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_alert_bg),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#93C5FD")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(callout_table)
    story.append(Spacer(1, 8))

    # Section 1: Prerequisites
    story.append(Paragraph("1. Client Hardware & System Checklist", h1_style))
    
    req_data = [
        ["Requirement", "Minimum Specification", "Recommended Specification"],
        ["Processor (CPU)", "Apple Silicon (M1/M2/M3) or 4-core PC", "Apple Silicon (M2/M3/M4 Pro/Max) or 8-core PC"],
        ["System Memory (RAM)", "8 GB Unified / DDR4", "16 GB or 24 GB Unified Memory"],
        ["Free Disk Storage", "15 GB SSD space", "25 GB+ SSD space"],
        ["Operating System", "macOS Sonoma (14+) or Windows 11 / Linux", "macOS Sequoia (15+)"],
        ["Power Connection", "Connected to power adapter during setup", "Always plugged into charger during clinic hours"]
    ]
    t_req = Table(req_data, colWidths=[110, 194, 200])
    t_req.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_light]),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t_req)
    story.append(Spacer(1, 8))

    # Section 2: Step-by-Step Installation
    story.append(Paragraph("2. Vendor Build & Client Installation (No Source Code Shared)", h1_style))
    
    story.append(Paragraph("Step 2.1: On Your Developer Machine — Tag & Publish Docker Images", h2_style))
    story.append(Paragraph("Build and publish compiled container images to your private Docker Hub or GitHub Container Registry:", body_style))
    story.append(Paragraph("<code>docker build -t yourusername/aura-backend:latest ./backend<br/>docker build -t yourusername/aura-frontend:latest ./frontend<br/>docker push yourusername/aura-backend:latest<br/>docker push yourusername/aura-frontend:latest</code>", code_style))

    story.append(Paragraph("Step 2.2: On the Client Laptop — Install Docker Desktop", h2_style))
    story.append(Paragraph("• Download and install <b>Docker Desktop</b> from <i>docker.com/products/docker-desktop</i>.", bullet_style))
    story.append(Paragraph("• In Docker Settings → General, enable: <b>Start Docker Desktop when you log in</b>.", bullet_style))
    story.append(Paragraph("• Under Settings → Resources, assign at least <b>4 CPU cores</b> and <b>6 GB RAM</b>.", bullet_style))

    story.append(Paragraph("Step 2.3: Provide Only 2 Files to the Client (<code>docker-compose.yml</code> & <code>.env</code>)", h2_style))
    story.append(Paragraph("Create a folder on the client's laptop (e.g. <code>~/aura</code>) containing ONLY these two files (no source code folders):", body_style))
    story.append(Paragraph(
        "<b><code>~/aura/docker-compose.yml</code></b>:<br/>"
        "<code>services:<br/>"
        "  backend:<br/>"
        "    image: yourusername/aura-backend:latest<br/>"
        "    ports: [\"8000:8000\"]<br/>"
        "    env_file: [.env]<br/>"
        "  frontend:<br/>"
        "    image: yourusername/aura-frontend:latest<br/>"
        "    ports: [\"3000:3000\"]<br/>"
        "    env_file: [.env]<br/>"
        "  ollama:<br/>"
        "    image: ollama/ollama:latest<br/>"
        "    volumes: [ollama_models:/root/.ollama]</code>", code_style
    ))

    story.append(PageBreak())

    # Page 2
    story.append(Paragraph("2. Vendor Build & Client Installation (Continued)", h1_style))

    story.append(Paragraph("Step 2.4: Configure the Client's <code>.env</code> File", h2_style))
    story.append(Paragraph("Populate <code>~/aura/.env</code> with their dedicated Supabase database credentials:", body_style))
    story.append(Paragraph("<code>SUPABASE_URL=https://&lt;client-ref&gt;.supabase.co<br/>SUPABASE_SERVICE_ROLE_KEY=&lt;service-role-key&gt;<br/>SUPABASE_JWT_SECRET=&lt;jwt-secret&gt;<br/>NEXT_PUBLIC_SUPABASE_ANON_KEY=&lt;anon-key&gt;<br/>NEXT_PUBLIC_API_URL=http://localhost:8000<br/>OWNER_EMAIL=&lt;client-email@domain.com&gt;</code>", code_style))

    story.append(Paragraph("Step 2.5: Launch Stack & Download Local LLM", h2_style))
    story.append(Paragraph("In Terminal on the client's laptop, run:", body_style))
    story.append(Paragraph("<code>cd ~/aura<br/>docker compose pull<br/>docker compose up -d</code>", code_style))
    story.append(Paragraph("• Docker pulls your compiled images and the official Ollama container.", bullet_style))
    story.append(Paragraph("• Verify health status: <code>curl http://localhost:8000/api/v1/health</code> → returns <code>{\"status\":\"ok\"}</code>.", bullet_style))

    story.append(Paragraph("Step 2.6: Configure Keep-Awake (Amphetamine)", h2_style))
    story.append(Paragraph("• Install <b>Amphetamine</b> from the Mac App Store (free).", bullet_style))
    story.append(Paragraph("• In <i>Preferences → Triggers</i>, set trigger: <b>When Docker Desktop is running → Keep awake indefinitely</b>.", bullet_style))
    story.append(Paragraph("• In <i>General</i>, check <b>Allow display to sleep</b> so the screen turns off safely during background processing.", bullet_style))

    story.append(Spacer(1, 8))

    # Section 3: Desktop Experience & Privacy Policy
    story.append(Paragraph("3. Client Experience: 1-Click Desktop App (PWA) & Name Privacy", h1_style))
    story.append(Paragraph("• <b>Install Desktop App:</b> Open <b>http://localhost:3000</b> in Chrome → click <b>Install App (⊕ icon)</b> in address bar → Aura is placed directly on their macOS Dock/Applications folder.", bullet_style))
    story.append(Paragraph("• <b>First-Name-Only Privacy Policy:</b> Across all clinician and patient views (Dashboard greeting, Patient roster, Session links, Schedule agenda, Memory search), Aura automatically formats and displays only the <b>first name</b> to protect privacy during screen sharing.", bullet_style))

    story.append(Spacer(1, 8))

    # Section 4: Clinician Handoff & Acceptance
    story.append(Paragraph("4. Clinician Onboarding & Acceptance Checklist", h1_style))
    
    check_steps = [
        ["Task", "Action Required", "Verification / Expected Outcome"],
        ["1. User Registration", "Sign up using clinician's primary work email", "Account created, onboarding wizard displayed"],
        ["2. Microphone Access", "Click 'Record' on New Session page", "Browser prompts for microphone access → Click Allow"],
        ["3. Test Audio Recording", "Record a 30-second mock conversation", "Waveform displays live audio levels in real time"],
        ["4. Test Transcription", "Click 'Generate Note' button", "Notification arrives in ~1 min with structured SOAP note"],
        ["5. Patient Memory", "Ask query: 'What symptoms were discussed?'", "Synthesizes answer with cited transcript excerpts"],
        ["6. PDF Export", "Click 'Export Note as PDF'", "Formatted PDF clinical note downloads to local drive"]
    ]
    t_check = Table(check_steps, colWidths=[95, 205, 204])
    t_check.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_accent),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_light]),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t_check)

    story.append(Spacer(1, 8))

    # Section 5: Support Runbook
    story.append(Paragraph("5. Support & Client FAQ", h1_style))
    story.append(Paragraph("• <b>Laptop Restart:</b> Docker Desktop starts automatically on login; the clinician simply clicks the Aura Dock icon.", bullet_style))
    story.append(Paragraph("• <b>Software Updates:</b> When you push a new release, the client simply runs <code>docker compose pull && docker compose up -d</code>.", bullet_style))
    story.append(Paragraph("• <b>Data Confidentiality:</b> Audio is permanently purged after note extraction; notes are indexed locally.", bullet_style))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated updated PDF at: {PDF_PATH}")

if __name__ == "__main__":
    build_pdf()
