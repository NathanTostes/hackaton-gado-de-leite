#!/usr/bin/env python3
"""
Gera o documento único de entrega (.docx) a partir dos arquivos de docs/.

A documentação é entregável obrigatório do Hackathon ("processo de desenvolvimento,
arquitetura tecnológica e regras de produção utilizadas"). Este script junta os
cinco documentos num só arquivo Word, com capa, sumário e estilos consistentes.

Uso: python3 scripts/gerar_docx.py
"""
from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

RAIZ = Path(__file__).resolve().parent.parent
DOCS = RAIZ / "docs"
# A pasta reference/ (material de origem) não vai para o repositório; a logo
# distribuída é a que o próprio app usa.
LOGO = next(
    (p for p in [RAIZ / "apps/mobile/assets/logo-dr-moo.jpg", RAIZ / "reference/logoDrMoo.jpeg"] if p.exists()),
    RAIZ / "apps/mobile/assets/logo-dr-moo.jpg",
)
SAIDA = DOCS / "DrMoo-Documentacao.docx"

# Paleta amostrada da logo (packages/ui/src/tokens.ts)
TEAL = RGBColor(0x01, 0x5B, 0x66)
TEAL_CLARO = RGBColor(0x0E, 0x7F, 0x8C)
PRETO = RGBColor(0x0F, 0x1F, 0x2C)
CINZA = RGBColor(0x42, 0x4E, 0x57)
CINZA_CLARO = RGBColor(0x7A, 0x85, 0x8D)
VERDE = RGBColor(0x2E, 0x8B, 0x5A)

FONTE = "Segoe UI"
FONTE_MONO = "Consolas"

ARQUIVOS = [
    "01-arquitetura.md",
    "02-base-de-conhecimento.md",
    "03-motor-de-inferencia.md",
    "04-processo-com-ia.md",
    "05-casos-de-teste.md",
]


# ---------------------------------------------------------------------------
# Utilidades de baixo nível (python-docx não expõe tudo que precisamos)
# ---------------------------------------------------------------------------

def sombrear(elemento, cor_hex: str) -> None:
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), cor_hex)
    elemento.append(shd)


def borda_esquerda(paragrafo, cor_hex: str, largura: int = 18) -> None:
    pPr = paragrafo._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    left = OxmlElement("w:left")
    left.set(qn("w:val"), "single")
    left.set(qn("w:sz"), str(largura))
    left.set(qn("w:space"), "8")
    left.set(qn("w:color"), cor_hex)
    pBdr.append(left)
    pPr.append(pBdr)


def campo(paragrafo, instrucao: str) -> None:
    """Insere um campo do Word (usado para o sumário e a numeração de páginas)."""
    run = paragrafo.add_run()
    ini = OxmlElement("w:fldChar")
    ini.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = instrucao
    sep = OxmlElement("w:fldChar")
    sep.set(qn("w:fldCharType"), "separate")
    fim = OxmlElement("w:fldChar")
    fim.set(qn("w:fldCharType"), "end")
    for e in (ini, instr, sep, fim):
        run._r.append(e)


# ---------------------------------------------------------------------------
# Estilos
# ---------------------------------------------------------------------------

def preparar_estilos(doc: Document) -> None:
    normal = doc.styles["Normal"]
    normal.font.name = FONTE
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = PRETO
    normal.paragraph_format.space_after = Pt(8)
    normal.paragraph_format.line_spacing = 1.18

    niveis = [
        ("Heading 1", 22, TEAL, True, 20, 10),
        ("Heading 2", 16, TEAL, True, 16, 8),
        ("Heading 3", 13, TEAL_CLARO, True, 12, 6),
        ("Heading 4", 11.5, PRETO, True, 10, 4),
    ]
    for nome, tam, cor, negrito, antes, depois in niveis:
        e = doc.styles[nome]
        e.font.name = FONTE
        e.font.size = Pt(tam)
        e.font.bold = negrito
        e.font.color.rgb = cor
        e.paragraph_format.space_before = Pt(antes)
        e.paragraph_format.space_after = Pt(depois)
        e.paragraph_format.keep_with_next = True


# ---------------------------------------------------------------------------
# Markdown inline → runs
# ---------------------------------------------------------------------------

PADRAO_INLINE = re.compile(r"(\*\*.+?\*\*|`[^`]+`|\*[^*]+?\*|\[[^\]]+\]\([^)]+\))")


def escrever_inline(paragrafo, texto: str, cor=None, tamanho=None) -> None:
    texto = texto.replace("\\|", "|")
    for parte in PADRAO_INLINE.split(texto):
        if not parte:
            continue
        if parte.startswith("**") and parte.endswith("**"):
            r = paragrafo.add_run(parte[2:-2])
            r.bold = True
        elif parte.startswith("`") and parte.endswith("`"):
            r = paragrafo.add_run(parte[1:-1])
            r.font.name = FONTE_MONO
            r.font.size = Pt((tamanho or 10.5) - 1)
            r.font.color.rgb = TEAL
        elif parte.startswith("*") and parte.endswith("*") and len(parte) > 2:
            r = paragrafo.add_run(parte[1:-1])
            r.italic = True
        elif parte.startswith("[") and "](" in parte:
            rotulo = parte[1 : parte.index("](")]
            r = paragrafo.add_run(rotulo)
            r.font.color.rgb = TEAL_CLARO
        else:
            r = paragrafo.add_run(parte)
        if cor is not None:
            r.font.color.rgb = cor
        if tamanho is not None:
            r.font.size = Pt(tamanho)


# ---------------------------------------------------------------------------
# Blocos
# ---------------------------------------------------------------------------

def bloco_codigo(doc: Document, linhas: list[str]) -> None:
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.left_indent = Inches(0.12)
    pf.space_before = Pt(6)
    pf.space_after = Pt(10)
    pf.line_spacing = 1.0
    sombrear(p._p.get_or_add_pPr(), "F3F5F6")
    borda_esquerda(p, "015B66", 24)
    for i, linha in enumerate(linhas):
        r = p.add_run(linha)
        r.font.name = FONTE_MONO
        r.font.size = Pt(8.5)
        r.font.color.rgb = PRETO
        if i < len(linhas) - 1:
            r.add_break()


def citacao(doc: Document, linhas: list[str]) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.2)
    p.paragraph_format.space_before = Pt(6)
    borda_esquerda(p, "7ED7A1", 24)
    escrever_inline(p, " ".join(linhas), cor=CINZA, tamanho=10)
    for r in p.runs:
        r.italic = True


def tabela(doc: Document, linhas: list[str]) -> None:
    def celulas(linha: str) -> list[str]:
        return [c.strip() for c in re.split(r"(?<!\\)\|", linha.strip())[1:-1]]

    cabecalho = celulas(linhas[0])
    corpo = [celulas(l) for l in linhas[2:] if l.strip()]
    if not cabecalho:
        return

    t = doc.add_table(rows=1, cols=len(cabecalho))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = True

    for i, texto in enumerate(cabecalho):
        cel = t.rows[0].cells[i]
        cel.text = ""
        sombrear(cel._tc.get_or_add_tcPr(), "015B66")
        p = cel.paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        escrever_inline(p, texto, cor=RGBColor(0xFF, 0xFF, 0xFF), tamanho=9)
        for r in p.runs:
            r.bold = True

    for n, linha_dados in enumerate(corpo):
        linha = t.add_row()
        for i, texto in enumerate(linha_dados[: len(cabecalho)]):
            cel = linha.cells[i]
            cel.text = ""
            if n % 2 == 1:
                sombrear(cel._tc.get_or_add_tcPr(), "F6F7F8")
            p = cel.paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            escrever_inline(p, texto, tamanho=9)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)


def separador(doc: Document) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(10)
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "DCE1E4")
    pBdr.append(bottom)
    pPr.append(pBdr)


# ---------------------------------------------------------------------------
# Conversão do markdown
# ---------------------------------------------------------------------------

def converter(doc: Document, markdown: str, deslocamento: int = 0) -> None:
    linhas = markdown.split("\n")
    i = 0
    while i < len(linhas):
        linha = linhas[i]
        cru = linha.rstrip()

        if not cru.strip():
            i += 1
            continue

        # Bloco de código
        if cru.lstrip().startswith("```"):
            i += 1
            buffer: list[str] = []
            while i < len(linhas) and not linhas[i].lstrip().startswith("```"):
                buffer.append(linhas[i])
                i += 1
            i += 1
            bloco_codigo(doc, buffer)
            continue

        # Tabela
        if cru.lstrip().startswith("|") and i + 1 < len(linhas) and set(
            linhas[i + 1].replace("|", "").replace(" ", "")
        ) <= {"-", ":"} and linhas[i + 1].strip():
            buffer = []
            while i < len(linhas) and linhas[i].lstrip().startswith("|"):
                buffer.append(linhas[i])
                i += 1
            tabela(doc, buffer)
            continue

        # Citação
        if cru.lstrip().startswith(">"):
            buffer = []
            while i < len(linhas) and linhas[i].lstrip().startswith(">"):
                buffer.append(linhas[i].lstrip()[1:].strip())
                i += 1
            citacao(doc, buffer)
            continue

        # Régua
        if cru.strip() in ("---", "***", "___"):
            separador(doc)
            i += 1
            continue

        # Títulos
        m = re.match(r"^(#{1,6})\s+(.*)$", cru)
        if m:
            nivel = min(len(m.group(1)) + deslocamento, 4)
            p = doc.add_heading(level=nivel)
            escrever_inline(p, m.group(2))
            estilo = doc.styles[f"Heading {nivel}"]
            for r in p.runs:
                r.font.color.rgb = estilo.font.color.rgb
                r.font.size = estilo.font.size
                r.font.name = FONTE
                r.bold = True
            i += 1
            continue

        # Listas
        m = re.match(r"^(\s*)[-*]\s+(.*)$", cru)
        if m:
            p = doc.add_paragraph(style="List Bullet")
            p.paragraph_format.space_after = Pt(3)
            if len(m.group(1)) >= 2:
                p.paragraph_format.left_indent = Inches(0.6)
            escrever_inline(p, m.group(2))
            i += 1
            continue

        m = re.match(r"^(\s*)\d+\.\s+(.*)$", cru)
        if m:
            p = doc.add_paragraph(style="List Number")
            p.paragraph_format.space_after = Pt(3)
            escrever_inline(p, m.group(2))
            i += 1
            continue

        # Parágrafo (junta linhas seguidas)
        buffer = [cru.strip()]
        i += 1
        while (
            i < len(linhas)
            and linhas[i].strip()
            and not re.match(r"^(#{1,6}\s|\s*[-*]\s|\s*\d+\.\s|\||>|```|---$)", linhas[i].rstrip())
        ):
            buffer.append(linhas[i].strip())
            i += 1
        p = doc.add_paragraph()
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        escrever_inline(p, " ".join(buffer))


# ---------------------------------------------------------------------------
# Capa, sumário e rodapé
# ---------------------------------------------------------------------------

def capa(doc: Document) -> None:
    for _ in range(2):
        doc.add_paragraph()

    if LOGO.exists():
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run().add_picture(str(LOGO), width=Inches(1.9))

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(18)
    r = p.add_run("Dr. Moo")
    r.font.size = Pt(44)
    r.font.bold = True
    r.font.color.rgb = TEAL
    r.font.name = FONTE

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Sistema especialista de anamnese e triagem\nde bovinos leiteiros em lactação")
    r.font.size = Pt(15)
    r.font.color.rgb = CINZA
    r.font.name = FONTE

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(26)
    r = p.add_run("DOCUMENTAÇÃO TÉCNICA")
    r.font.size = Pt(12)
    r.font.bold = True
    r.font.color.rgb = VERDE
    r.font.name = FONTE

    for texto, tam, cor in [
        ("Hackathon UFJF 2026", 14, PRETO),
        ("XXVIII Semana da Computação do DCC/UFJF", 11, CINZA),
        ("RERUM Engenharia de Sistemas", 11, CINZA),
        ("Tema T1 — Anamnese", 11, TEAL),
    ]:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run(texto)
        r.font.size = Pt(tam)
        r.font.color.rgb = cor
        r.font.name = FONTE
        if tam >= 14:
            r.font.bold = True

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(40)
    r = p.add_run(
        "Base de conhecimento explícita e versionada · motor de inferência determinístico\n"
        "Roda por completo em localhost · nenhum modelo de linguagem participa do diagnóstico"
    )
    r.font.size = Pt(9.5)
    r.font.italic = True
    r.font.color.rgb = CINZA_CLARO
    r.font.name = FONTE

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def sumario(doc: Document) -> None:
    p = doc.add_paragraph()
    r = p.add_run("Sumário")
    r.font.size = Pt(20)
    r.font.bold = True
    r.font.color.rgb = TEAL
    r.font.name = FONTE

    p = doc.add_paragraph()
    r = p.add_run(
        "Para preencher os números de página: abra no Word, clique com o botão direito "
        "sobre o sumário abaixo e escolha “Atualizar campo”."
    )
    r.font.size = Pt(9)
    r.font.italic = True
    r.font.color.rgb = CINZA_CLARO

    campo(doc.add_paragraph(), 'TOC \\o "1-3" \\h \\z \\u')
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def rodape(doc: Document) -> None:
    for secao in doc.sections:
        p = secao.footer.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run("Dr. Moo · Hackathon UFJF 2026 · Tema T1 — Anamnese     ")
        r.font.size = Pt(8)
        r.font.color.rgb = CINZA_CLARO
        r.font.name = FONTE
        campo(p, "PAGE")
        for run in p.runs:
            run.font.size = Pt(8)
            run.font.color.rgb = CINZA_CLARO
            run.font.name = FONTE


# ---------------------------------------------------------------------------

def main() -> None:
    doc = Document()
    for secao in doc.sections:
        secao.page_width = Inches(8.27)
        secao.page_height = Inches(11.69)
        secao.left_margin = Inches(0.95)
        secao.right_margin = Inches(0.95)
        secao.top_margin = Inches(0.9)
        secao.bottom_margin = Inches(0.9)

    preparar_estilos(doc)
    capa(doc)
    sumario(doc)

    # O README entra como apresentação geral, antes dos documentos técnicos.
    doc.add_heading("Visão geral", level=1)
    readme = (RAIZ / "README.md").read_text(encoding="utf-8")
    # Remove o título e o bloco de licença final: viram capa e anexo.
    readme = re.sub(r"^# Dr\. Moo\n", "", readme)
    readme = readme.split("## Licença")[0]
    converter(doc, readme, deslocamento=1)

    for nome in ARQUIVOS:
        caminho = DOCS / nome
        if not caminho.exists():
            print(f"  (ausente: {nome})")
            continue
        doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
        converter(doc, caminho.read_text(encoding="utf-8"))
        print(f"  + {nome}")

    rodape(doc)
    doc.save(SAIDA)

    tamanho = SAIDA.stat().st_size / 1024
    print(f"\n{SAIDA.relative_to(RAIZ)} ({tamanho:.0f} KB)")


if __name__ == "__main__":
    main()
