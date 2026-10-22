#!/usr/bin/env python3
"""
Gera a apresentação de entrega (.pptx) do Dr. Moo.

A apresentação é entregável obrigatório do Hackathon. O deck é construído em
código para que a identidade visual saia exatamente da paleta amostrada da logo
e para que o conteúdo possa ser regerado quando a base de conhecimento mudar.

python-pptx não expõe animações; elas são injetadas como XML de `<p:timing>`
diretamente no slide (ver `animar()`), junto com as transições.

Uso: python3 scripts/gerar_pptx.py
"""
from __future__ import annotations

import copy
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import nsdecls, qn
from pptx.util import Emu, Inches, Pt
from lxml import etree

RAIZ = Path(__file__).resolve().parent.parent
# A pasta reference/ (material de origem) não vai para o repositório; a logo
# distribuída é a que o próprio app usa.
LOGO = next(
    (p for p in [RAIZ / "apps/mobile/assets/logo-dr-moo.jpg", RAIZ / "reference/logoDrMoo.jpeg"] if p.exists()),
    RAIZ / "apps/mobile/assets/logo-dr-moo.jpg",
)
SAIDA = RAIZ / "docs" / "DrMoo-Apresentacao.pptx"

# Fotos da visita técnica (pasta de referência, fora do repositório).
PASTA_EMBRAPA = RAIZ / "reference" / "imagens visita embrapa"
FOTOS_EMBRAPA = [
    PASTA_EMBRAPA / "WhatsApp Image 2026-10-20 at 11.43.53 AM.jpeg",
    PASTA_EMBRAPA / "WhatsApp Image 2026-10-20 at 11.43.54 AM.jpeg",
    PASTA_EMBRAPA / "WhatsApp Image 2026-10-20 at 11.43.55 AM.jpeg",
    PASTA_EMBRAPA / "WhatsApp Image 2026-10-20 at 11.43.56 AM.jpeg",
]

# QR codes gerados por `scripts/gerar_pptx.py` apontando para o site publicado
# e para a Play Store (placeholder até o app ser publicado na loja).
QR_SITE = RAIZ / "docs" / "img" / "qr_site.png"
QR_PLAY = RAIZ / "docs" / "img" / "qr_play.png"

# Paleta amostrada da logo (packages/ui/src/tokens.ts)
TEAL = RGBColor(0x01, 0x5B, 0x66)
TEAL_ESCURO = RGBColor(0x01, 0x3A, 0x41)
TEAL_CLARO = RGBColor(0x0E, 0x7F, 0x8C)
CREME = RGBColor(0xFE, 0xF6, 0xE9)
BRANCO = RGBColor(0xFF, 0xFF, 0xFF)
PRETO = RGBColor(0x0F, 0x1F, 0x2C)
CINZA = RGBColor(0x42, 0x4E, 0x57)
CINZA_CLARO = RGBColor(0x7A, 0x85, 0x8D)
BORDA = RGBColor(0xDC, 0xE1, 0xE4)
VERDE = RGBColor(0x7E, 0xD7, 0xA1)
VERDE_ESCURO = RGBColor(0x2E, 0x8B, 0x5A)
ROSA = RGBColor(0xFE, 0xA7, 0x9D)
ATENCAO = RGBColor(0xE8, 0xA3, 0x3D)
ALERTA = RGBColor(0xC0, 0x39, 0x2B)

# Segoe UI em vez de Inter: a fonte da marca pode não estar instalada na máquina
# da apresentação, e substituição de fonte no meio do slide estraga o layout.
FONTE = "Segoe UI"
FONTE_MONO = "Consolas"

L = 13.333  # largura do slide, em polegadas
A = 7.5     # altura


# ===========================================================================
# Animações e transições (XML cru — python-pptx não tem API para isso)
# ===========================================================================

P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"

EFEITOS = {
    # nome:            (presetID, presetSubtype, filtro animEffect)
    "fade":            (10, 0, "fade"),
    "subir":           (2, 4, "slide(fromBottom)"),
    "entrar_esquerda": (2, 8, "slide(fromLeft)"),
    "entrar_direita":  (2, 2, "slide(fromRight)"),
    "ampliar":         (23, 16, "zoom(in)"),
    "revelar":         (22, 10, "wipe(left)"),
    "revelar_cima":    (22, 4, "wipe(up)"),
}


def _efeito_xml(ids: list[int], spid: int, nome: str, atraso: int, duracao: int) -> str:
    preset, subtipo, filtro = EFEITOS[nome]
    a, b, c = ids[0], ids[0] + 1, ids[0] + 2
    ids[0] += 3
    return f"""
    <p:par>
      <p:cTn id="{a}" presetID="{preset}" presetClass="entr" presetSubtype="{subtipo}"
             fill="hold" grpId="0" nodeType="withEffect">
        <p:stCondLst><p:cond delay="{atraso}"/></p:stCondLst>
        <p:childTnLst>
          <p:set>
            <p:cBhvr>
              <p:cTn id="{b}" dur="1" fill="hold">
                <p:stCondLst><p:cond delay="0"/></p:stCondLst>
              </p:cTn>
              <p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>
              <p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>
            </p:cBhvr>
            <p:to><p:strVal val="visible"/></p:to>
          </p:set>
          <p:animEffect transition="in" filter="{filtro}">
            <p:cBhvr>
              <p:cTn id="{c}" dur="{duracao}"/>
              <p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>
            </p:cBhvr>
          </p:animEffect>
        </p:childTnLst>
      </p:cTn>
    </p:par>"""


def animar(slide, sequencia: list[tuple], atraso_inicial: int = 150, intervalo: int = 220) -> None:
    """
    Aplica entradas automáticas e escalonadas às formas do slide.

    `sequencia` é uma lista de (forma, efeito) ou (forma, efeito, atraso_ms).
    As animações disparam sozinhas quando o slide aparece — o apresentador não
    precisa clicar nem contar cliques, o que importa quando se está nervoso.
    """
    if not sequencia:
        return

    ids = [10]
    efeitos: list[str] = []
    atraso = atraso_inicial
    for item in sequencia:
        alvo, nome = item[0], item[1]
        if len(item) > 2:
            atraso = item[2]
        # Um item pode ser uma forma ou um conjunto de formas que entram juntas
        # (um cartão e sua tarja colorida, por exemplo) — senão a tarja apareceria
        # sozinha antes do cartão.
        formas = alvo if isinstance(alvo, (list, tuple)) else [alvo]
        for forma in formas:
            efeitos.append(_efeito_xml(ids, forma.shape_id, nome, atraso, 500))
        atraso += intervalo

    xml = f"""<p:timing xmlns:p="{P_NS}">
  <p:tnLst>
    <p:par>
      <p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot">
        <p:childTnLst>
          <p:seq concurrent="1" nextAc="seek">
            <p:cTn id="2" dur="indefinite" nodeType="mainSeq">
              <p:childTnLst>
                <p:par>
                  <p:cTn id="3" fill="hold">
                    <p:stCondLst><p:cond delay="0"/></p:stCondLst>
                    <p:childTnLst>
                      <p:par>
                        <p:cTn id="4" fill="hold">
                          <p:stCondLst><p:cond delay="0"/></p:stCondLst>
                          <p:childTnLst>{"".join(efeitos)}
                          </p:childTnLst>
                        </p:cTn>
                      </p:par>
                    </p:childTnLst>
                  </p:cTn>
                </p:par>
              </p:childTnLst>
            </p:cTn>
            <p:prevCondLst>
              <p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond>
            </p:prevCondLst>
            <p:nextCondLst>
              <p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond>
            </p:nextCondLst>
          </p:seq>
        </p:childTnLst>
      </p:cTn>
    </p:par>
  </p:tnLst>
</p:timing>"""
    slide._element.append(etree.fromstring(xml))


def transicao(slide, tipo: str = "fade", velocidade: str = "med") -> None:
    interno = {
        "fade": "<p:fade/>",
        "push": '<p:push dir="u"/>',
        "wipe": '<p:wipe dir="r"/>',
        "cut": "<p:cut/>",
    }[tipo]
    xml = f'<p:transition xmlns:p="{P_NS}" spd="{velocidade}">{interno}</p:transition>'
    # Ordem exigida pelo esquema: cSld, clrMapOvr, transition, timing.
    elemento = slide._element
    timing = elemento.find(qn("p:timing"))
    novo = etree.fromstring(xml)
    if timing is not None:
        timing.addprevious(novo)
    else:
        elemento.append(novo)


# ===========================================================================
# Blocos de construção
# ===========================================================================

def nova(prs, fundo: RGBColor):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = fundo
    return slide


def texto(
    slide, x, y, cx, cy, conteudo, *, tamanho=18, cor=PRETO, negrito=False,
    alinhamento=PP_ALIGN.LEFT, fonte=FONTE, italico=False, entrelinha=1.2, ancora=MSO_ANCHOR.TOP,
):
    caixa = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(cx), Inches(cy))
    tf = caixa.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = ancora
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0

    linhas = conteudo.split("\n")
    for i, linha in enumerate(linhas):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = alinhamento
        p.line_spacing = entrelinha
        r = p.add_run()
        r.text = linha
        r.font.size = Pt(tamanho)
        r.font.bold = negrito
        r.font.italic = italico
        r.font.color.rgb = cor
        r.font.name = fonte
    return caixa


def retangulo(slide, x, y, cx, cy, *, preenchimento=None, contorno=None, raio=0.08, espessura=1.25):
    forma = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(cx), Inches(cy)
    )
    # Arredondamento do canto (o padrão do PowerPoint é exagerado).
    forma.adjustments[0] = raio
    if preenchimento is None:
        forma.fill.background()
    else:
        forma.fill.solid()
        forma.fill.fore_color.rgb = preenchimento
    if contorno is None:
        forma.line.fill.background()
    else:
        forma.line.color.rgb = contorno
        forma.line.width = Pt(espessura)
    forma.shadow.inherit = False
    forma.text_frame.word_wrap = True
    return forma


def faixa(slide, x, y, cx, cy, cor):
    forma = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(cx), Inches(cy))
    forma.fill.solid()
    forma.fill.fore_color.rgb = cor
    forma.line.fill.background()
    forma.shadow.inherit = False
    return forma


def titulo_slide(slide, titulo, subtitulo=None, *, escuro=False):
    cor_titulo = BRANCO if escuro else TEAL
    cor_sub = RGBColor(0xA8, 0xC8, 0xCD) if escuro else CINZA
    formas = [faixa(slide, 0.8, 0.72, 0.09, 0.52, VERDE if escuro else TEAL)]
    formas.append(texto(slide, 1.05, 0.62, L - 2, 0.7, titulo, tamanho=30, cor=cor_titulo, negrito=True))
    if subtitulo:
        formas.append(texto(slide, 1.05, 1.32, L - 2.2, 0.5, subtitulo, tamanho=14, cor=cor_sub))
    return formas


def cartao(slide, x, y, cx, cy, titulo, corpo, *, cor=TEAL, escuro=False, tamanho_titulo=15):
    fundo = RGBColor(0x05, 0x47, 0x50) if escuro else BRANCO
    forma = retangulo(slide, x, y, cx, cy, preenchimento=fundo, contorno=BORDA if not escuro else RGBColor(0x1A, 0x6B, 0x74))
    tarja = faixa(slide, x, y, 0.055, cy, cor)
    tf = forma.text_frame
    tf.margin_left = Inches(0.26)
    tf.margin_right = Inches(0.18)
    tf.margin_top = Inches(0.17)
    tf.vertical_anchor = MSO_ANCHOR.TOP

    p = tf.paragraphs[0]
    p.line_spacing = 1.05
    r = p.add_run()
    r.text = titulo
    r.font.size = Pt(tamanho_titulo)
    r.font.bold = True
    r.font.color.rgb = BRANCO if escuro else PRETO
    r.font.name = FONTE

    for linha in corpo.split("\n"):
        p = tf.add_paragraph()
        p.line_spacing = 1.2
        p.space_before = Pt(5)
        r = p.add_run()
        r.text = linha
        r.font.size = Pt(11)
        r.font.color.rgb = RGBColor(0xC3, 0xDC, 0xE0) if escuro else CINZA
        r.font.name = FONTE
    return [forma, tarja]


def numerao(slide, x, y, cx, numero, rotulo, *, cor=TEAL, escuro=False):
    """Um número grande com legenda — para estatísticas de impacto."""
    g = []
    g.append(texto(slide, x, y, cx, 0.8, numero, tamanho=42, cor=cor, negrito=True, alinhamento=PP_ALIGN.CENTER))
    g.append(
        texto(slide, x, y + 0.78, cx, 0.7, rotulo, tamanho=11,
              cor=RGBColor(0xC3, 0xDC, 0xE0) if escuro else CINZA,
              alinhamento=PP_ALIGN.CENTER, entrelinha=1.1)
    )
    return g


def caixa_codigo(slide, x, y, cx, cy, linhas, *, escuro=True, tamanho=12):
    fundo = RGBColor(0x05, 0x2E, 0x34) if escuro else RGBColor(0xF3, 0xF5, 0xF6)
    forma = retangulo(slide, x, y, cx, cy, preenchimento=fundo, contorno=None, raio=0.04)
    tf = forma.text_frame
    tf.margin_left = Inches(0.26)
    tf.margin_top = Inches(0.18)
    tf.word_wrap = True
    for i, (linha, destaque) in enumerate(linhas):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.line_spacing = 1.35
        r = p.add_run()
        r.text = linha
        r.font.size = Pt(tamanho)
        r.font.name = FONTE_MONO
        r.font.bold = destaque
        if destaque:
            r.font.color.rgb = VERDE if escuro else TEAL
        else:
            r.font.color.rgb = RGBColor(0xC3, 0xDC, 0xE0) if escuro else CINZA
    return forma


def rodape(slide, texto_rodape, *, escuro=False):
    return texto(
        slide, 0.8, A - 0.62, L - 1.6, 0.35, texto_rodape, tamanho=9.5,
        cor=RGBColor(0x6C, 0x93, 0x99) if escuro else CINZA_CLARO, italico=True,
    )


def nota(slide, conteudo):
    """Nota do apresentador — o roteiro de fala não aparece na projeção."""
    slide.notes_slide.notes_text_frame.text = conteudo


# ===========================================================================
# Slides
# ===========================================================================

def construir() -> Presentation:
    prs = Presentation()
    prs.slide_width = Inches(L)
    prs.slide_height = Inches(A)

    # ---------------------------------------------------------------- 1. Capa
    s = nova(prs, TEAL)
    faixa(s, 0, 0, L, 0.1, VERDE)
    formas = []
    if LOGO.exists():
        img = s.shapes.add_picture(str(LOGO), Inches(L / 2 - 1.05), Inches(0.85), height=Inches(2.1))
        formas.append((img, "ampliar"))

    formas.append((texto(s, 0, 3.15, L, 1.0, "Dr. Moo", tamanho=60, cor=BRANCO, negrito=True,
                         alinhamento=PP_ALIGN.CENTER), "subir"))
    formas.append((texto(s, 1.5, 4.25, L - 3, 0.9,
                         "Sistema especialista de anamnese e triagem\nde bovinos leiteiros em lactação",
                         tamanho=19, cor=RGBColor(0xBF, 0xE3, 0xE7), alinhamento=PP_ALIGN.CENTER,
                         entrelinha=1.25), "fade"))
    formas.append((faixa(s, L / 2 - 1.1, 5.42, 2.2, 0.035, VERDE), "revelar"))
    formas.append((texto(s, 0, 5.72, L, 1.0,
                         "Hackathon UFJF 2026  ·  XXVIII Semana da Computação do DCC/UFJF\n"
                         "RERUM Engenharia de Sistemas  ·  Tema T1 — Anamnese",
                         tamanho=13, cor=RGBColor(0x9D, 0xC8, 0xCE), alinhamento=PP_ALIGN.CENTER,
                         entrelinha=1.35), "fade"))
    animar(s, formas, atraso_inicial=200, intervalo=280)
    transicao(s, "fade", "slow")
    nota(s, "Abertura. Nome do grupo e integrantes. 'Escolhemos o tema T1, anamnese.'")

    # ------------------------------------------------------------ 2. Problema
    s = nova(prs, BRANCO)
    f = titulo_slide(s, "O problema", "A mastite é a doença mais frequente das vacas de leite")
    cartoes = [
        cartao(s, 0.8, 2.1, 3.85, 1.95, "Reduz quantidade e qualidade",
               "Vacas com mastite produzem menos leite\ne elevam a CCS do tanque inteiro.", cor=ALERTA),
        cartao(s, 4.85, 2.1, 3.85, 1.95, "É altamente contagiosa",
               "Passa de vaca para vaca durante a ordenha,\npelas mãos do retireiro e pelos tetos.", cor=ATENCAO),
        cartao(s, 8.9, 2.1, 3.65, 1.95, "Pode custar a mama — ou a vaca",
               "Sem tratamento rápido, o animal perde\no quarto mamário ou morre.", cor=ALERTA),
    ]
    nums = []
    nums += numerao(s, 0.8, 4.5, 3.0, "≤ 2%", "meta de mastite clínica\npor mês no rebanho", cor=TEAL)
    nums += numerao(s, 4.0, 4.5, 3.0, "≤ 20%", "meta de vacas com\nmastite subclínica", cor=TEAL)
    nums += numerao(s, 7.2, 4.5, 3.0, "200 mil", "CCS por mL acima da qual\nhá mastite subclínica", cor=TEAL)
    nums += numerao(s, 10.3, 4.5, 2.4, "3 meses", "de CMT positivo\n= mastite crônica", cor=TEAL)
    rodape(s, "Fonte: EMBRAPA. Como identificar a vaca com mastite em sua propriedade, 2015, p. 9, 34, 35, 38 e 39.")
    animar(s, [(x, "subir") for x in f] + [(c, "subir") for c in cartoes] + [(n, "fade") for n in nums])
    transicao(s, "push")
    nota(s, "O produtor perde dinheiro três vezes: menos leite, leite descartado e vaca perdida. "
            "E a doença mais comum é justamente a que dá para pegar cedo com teste de campo barato.")

    # -------------------------------------------------------------- 3. Desafio
    s = nova(prs, TEAL_ESCURO)
    faixa(s, 0, 0, 0.14, A, VERDE)
    f = [
        texto(s, 1.2, 1.5, L - 2.6, 0.5, "O QUE O REGULAMENTO PEDE", tamanho=13, cor=VERDE, negrito=True),
        texto(s, 1.2, 2.25, L - 2.6, 2.2,
              "“Construir uma aplicação para usuário final que resolva um\n"
              "problema da pecuária leiteira por meio de uma base explícita\n"
              "de conhecimento e um motor de inferência.”",
              tamanho=26, cor=BRANCO, entrelinha=1.3),
        texto(s, 1.2, 4.9, L - 2.6, 0.5,
              "T1 — Anamnese: coleta estruturada de sinais e histórico de bovinos leiteiros "
              "em lactação, com triagem explicável.",
              tamanho=14, cor=RGBColor(0xBF, 0xE3, 0xE7)),
        texto(s, 1.2, 5.8, L - 2.6, 0.5, "A solução final deve rodar por completo em LOCALHOST.",
              tamanho=14, cor=VERDE, negrito=True),
    ]
    animar(s, [(f[0], "fade"), (f[1], "entrar_esquerda"), (f[2], "fade"), (f[3], "fade")], intervalo=320)
    transicao(s, "fade")
    nota(s, "Ler a citação em voz alta. É o critério pelo qual seremos avaliados.")

    # ------------------------------------------------- 4. Não use a LLM
    s = nova(prs, BRANCO)
    f = titulo_slide(s, "“Não use a LLM como o sistema especialista”", "Diretriz do regulamento — e a decisão que organiza o projeto inteiro")
    cartoes = [
        cartao(s, 0.8, 2.15, 2.9, 2.1, "Determinístico",
               "Os mesmos sinais produzem\nsempre o mesmo parecer.", cor=TEAL),
        cartao(s, 3.9, 2.15, 2.9, 2.1, "Auditável",
               "Dá para abrir e ver qual regra\ndisparou — e por quê.", cor=TEAL),
        cartao(s, 7.0, 2.15, 2.9, 2.1, "Revisável pelo veterinário",
               "A base é JSON com fonte citada.\nNão é preciso saber programar.", cor=TEAL),
        cartao(s, 10.1, 2.15, 2.45, 2.1, "Versionado",
               "Um prontuário antigo roda\ncom a base da época.", cor=TEAL),
    ]
    destaque = retangulo(s, 0.8, 4.65, L - 1.6, 1.45, preenchimento=RGBColor(0xEC, 0xF8, 0xF1), contorno=VERDE_ESCURO)
    tf = destaque.text_frame
    tf.margin_left = Inches(0.3)
    tf.margin_top = Inches(0.22)
    p = tf.paragraphs[0]
    r = p.add_run()
    r.text = "Nenhuma dessas quatro propriedades sobrevive se a decisão sair de um modelo de linguagem."
    r.font.size = Pt(15); r.font.bold = True; r.font.color.rgb = PRETO; r.font.name = FONTE
    p = tf.add_paragraph(); p.space_before = Pt(7)
    r = p.add_run()
    r.text = ("No código do aplicativo: zero chamadas de rede em tempo de execução, zero chaves de API, "
              "zero referências a serviço de LLM. O app funciona com o aparelho em modo avião.")
    r.font.size = Pt(12); r.font.color.rgb = CINZA; r.font.name = FONTE
    animar(s, [(x, "subir") for x in f] + [(c, "subir") for c in cartoes] + [(destaque, "revelar")])
    transicao(s, "push")
    nota(s, "Este é o slide-chave. A IA construiu o sistema; ela não decide nada em runtime.")

    # ---------------------------------------------------------- 5. Arquitetura
    s = nova(prs, BRANCO)
    f = titulo_slide(s, "Arquitetura", "As quatro camadas do modelo conceitual de sistema especialista")
    camadas = [
        cartao(s, 0.8, 2.1, L - 1.6, 1.05, "Interface do usuário   ·   apps/mobile",
               "Expo / React Native + Web — um código roda no Android e em localhost:8081.", cor=ROSA),
        cartao(s, 0.8, 3.3, 6.0, 1.3, "Motor de inferência   ·   packages/engine",
               "Casa regras com fatos, resolve conflito, dispara, combina CF e gera o traço.\n"
               "TypeScript puro, ZERO dependências.", cor=VERDE_ESCURO),
        cartao(s, 7.1, 3.3, 5.45, 1.3, "Módulo de explicação",
               "Responde “por quê?” e “como?”\na partir do traço de inferência.", cor=VERDE_ESCURO),
        cartao(s, 0.8, 4.75, 6.0, 1.3, "Base de conhecimento   ·   packages/knowledge",
               "44 regras de produção em JSON, com pesos (CF), fonte citada e versão.", cor=TEAL),
        cartao(s, 7.1, 4.75, 5.45, 1.3, "Fontes de dados   ·   packages/db",
               "SQLite local: prontuário, histórico de CMT,\nprodução, tratamentos.", cor=TEAL),
    ]
    rod = rodape(s, "O motor não importa React, nem SQLite, nem nada de I/O. É isso que o torna testável em milissegundos — e auditável.")
    animar(s, [(x, "fade") for x in f] + [(c, "subir") for c in camadas] + [(rod, "fade")], intervalo=200)
    transicao(s, "push")
    nota(s, "Mostrar que o desenho é o do slide 14 da apresentação do Hackathon, camada por camada.")

    # ------------------------------------------------- 5b. Escolha da tecnologia
    s = nova(prs, BRANCO)
    f = titulo_slide(s, "Por que essa stack", "Cada escolha técnica persegue o mesmo requisito: localhost, offline, determinístico")
    cartoes = [
        cartao(s, 0.8, 2.1, 2.9, 2.15, "TypeScript de ponta a ponta",
               "Um único tipo atravessa app,\nmotor e banco. Contrato\nquebrado aparece no editor,\nnão em produção.", cor=TEAL),
        cartao(s, 3.9, 2.1, 2.9, 2.15, "Expo · React Native + Web",
               "Um código-fonte roda no\nAndroid e no navegador\n(localhost:8081) — sem manter\ndois apps em paralelo.", cor=TEAL),
        cartao(s, 7.0, 2.1, 2.9, 2.15, "Motor zero dependências",
               "TypeScript puro, não importa\nReact nem SQLite. Roda e\ntesta em milissegundos,\nisolado do resto.", cor=TEAL),
        cartao(s, 10.1, 2.1, 2.45, 2.15, "SQLite local",
               "Prontuário, histórico e\nplanilha ficam no aparelho.\nNenhuma chamada de rede\ndecide nada.", cor=TEAL),
    ]
    destaque = retangulo(s, 0.8, 4.65, L - 1.6, 1.45, preenchimento=RGBColor(0xEC, 0xF8, 0xF1), contorno=VERDE_ESCURO)
    tf = destaque.text_frame
    tf.margin_left = Inches(0.3); tf.margin_top = Inches(0.22)
    p = tf.paragraphs[0]
    r = p.add_run(); r.text = "Nenhuma dessas escolhas é modismo."
    r.font.size = Pt(15); r.font.bold = True; r.font.color.rgb = PRETO; r.font.name = FONTE
    p = tf.add_paragraph(); p.space_before = Pt(7)
    r = p.add_run()
    r.text = ("Todas servem ao mesmo requisito do regulamento: a solução final roda por completo em "
              "localhost, sem servidor, sem LLM em runtime — determinística e auditável de ponta a ponta.")
    r.font.size = Pt(12); r.font.color.rgb = CINZA; r.font.name = FONTE
    animar(s, [(x, "subir") for x in f] + [(c, "subir") for c in cartoes] + [(destaque, "revelar")])
    transicao(s, "push")
    nota(s, "Se perguntarem 'por que não Flutter / Next.js / Firebase': a resposta é sempre a mesma — "
            "localhost, offline, zero dependência de serviço externo.")

    # ------------------------------------------------------------ 6. Base de conhecimento
    s = nova(prs, BRANCO)
    f = titulo_slide(s, "A base de conhecimento", "Dado, não programa: JSON que um médico-veterinário consegue ler e corrigir")
    nums = []
    nums += numerao(s, 0.8, 2.05, 2.3, "44", "regras de\nprodução")
    nums += numerao(s, 3.1, 2.05, 2.3, "48", "perguntas, com\ncusto de obtenção")
    nums += numerao(s, 5.4, 2.05, 2.3, "28", "hipóteses\ndiagnósticas")
    nums += numerao(s, 7.7, 2.05, 2.3, "28", "casos de teste com\nresultado esperado")
    codigo = caixa_codigo(s, 0.8, 3.9, L - 1.6, 2.35, [
        ('MAST-CLIN-G1 — Mastite clínica grau 1', True),
        ('', False),
        ('SE   grumos ou pus nos primeiros jatos', False),
        ('  OU leite com coloração alterada', False),
        ('  OU leite com consistência alterada', False),
        ('ENTÃO diagnóstico = mastite clínica grau 1   (CF 0,95)', True),
        ('', False),
        ('Fonte: EMBRAPA, Mastite, 2015, p. 12 e p. 19-20.   Status: validada', False),
    ], tamanho=13)
    animar(s, [(x, "fade") for x in f] + [(n, "subir") for n in nums] + [(codigo, "revelar")])
    transicao(s, "push")
    nota(s, "Ler a regra em voz alta. O ponto é que ela é legível por quem entende de vaca, não de código.")

    # ------------------------------------------------------- 7. Procedência
    s = nova(prs, BRANCO)
    f = titulo_slide(s, "Procedência do conhecimento", "O que foi verificado e o que ainda não foi — dito em voz alta")
    a1 = cartao(s, 0.8, 2.15, 5.85, 2.0, "17 regras   ·   validadas",
                "Grupo de mastite, extraído integralmente da cartilha da Embrapa\n"
                "Gado de Leite (2015), com a PÁGINA citada regra a regra.", cor=VERDE_ESCURO)
    a2 = cartao(s, 6.95, 2.15, 5.6, 2.0, "27 regras   ·   a revisar",
                "Demais grupos clínicos, formalizados a partir de consenso\n"
                "veterinário geral, sem conferência com fonte primária.", cor=ATENCAO)
    destaque = retangulo(s, 0.8, 4.5, L - 1.6, 1.6, preenchimento=CREME, contorno=ATENCAO)
    tf = destaque.text_frame
    tf.margin_left = Inches(0.3); tf.margin_top = Inches(0.2)
    p = tf.paragraphs[0]
    r = p.add_run(); r.text = "No aplicativo, toda conclusão que depende dessas regras aparece com o selo “requer validação técnica”."
    r.font.size = Pt(14); r.font.bold = True; r.font.color.rgb = PRETO; r.font.name = FONTE
    p = tf.add_paragraph(); p.space_before = Pt(8)
    r = p.add_run()
    r.text = ("Uma LLM produz regra clínica plausível com a mesma fluência com que produz regra verificada — "
              "e a diferença não aparece no texto gerado. Marcar a fronteira é informação clínica, não fraqueza.")
    r.font.size = Pt(12); r.font.color.rgb = CINZA; r.font.name = FONTE
    animar(s, [(x, "fade") for x in f] + [(a1, "entrar_esquerda"), (a2, "entrar_direita"), (destaque, "subir")])
    transicao(s, "push")
    nota(s, "Este slide costuma ganhar pontos: mostra consciência do limite do que foi construído.")

    # ------------------------------------------------- 7b. Visita à Embrapa
    s = nova(prs, BRANCO)
    f = titulo_slide(s, "Visita à Embrapa Gado de Leite", "Juiz de Fora — confrontar o protótipo com quem escreveu a cartilha")
    posicoes = [(0.8, 2.15), (6.95, 2.15), (0.8, 4.55), (6.95, 4.55)]
    fotos = []
    for (x, y), caminho in zip(posicoes, FOTOS_EMBRAPA):
        if caminho.exists():
            moldura = retangulo(s, x, y, 5.6, 2.2, preenchimento=BRANCO, contorno=BORDA, raio=0.03)
            fotos.append(moldura)
            img = s.shapes.add_picture(str(caminho), Inches(x + 0.08), Inches(y + 0.08), height=Inches(2.04))
            fotos.append(img)
    rod = rodape(s, "A mesma instituição autora da cartilha usada como fonte das 17 regras validadas de mastite.")
    animar(s, [(x, "fade") for x in f] + [(x, "subir") for x in fotos] + [(rod, "fade")], intervalo=160)
    transicao(s, "push")
    nota(s, "Contar como foi a visita: o que a equipe perguntou e o que a Embrapa confirmou sobre as metas e as regras de mastite.")

    # --------------------------------------------------------- 8. O motor
    s = nova(prs, BRANCO)
    f = titulo_slide(s, "O motor de inferência", "Progressivo para concluir, regressivo para decidir o que perguntar")
    c = [
        cartao(s, 0.8, 2.1, 5.85, 1.75, "Encadeamento PROGRESSIVO",
               "Dispara UMA regra por ciclo — a vencedora da resolução de\n"
               "conflito — e repete até o ponto fixo. Com refração.", cor=TEAL),
        cartao(s, 6.95, 2.1, 5.6, 1.75, "Encadeamento REGRESSIVO",
               "Escolhe a próxima pergunta pelo que ainda pode mudar o\n"
               "diagnóstico, dividido pelo custo de obter a resposta.", cor=TEAL),
        cartao(s, 0.8, 4.05, 3.85, 1.95, "Resolução de conflito",
               "1. bandeira vermelha\n2. especificidade\n3. prioridade\n4. recência\n5. ordem de declaração", cor=TEAL_CLARO),
        cartao(s, 4.85, 4.05, 3.85, 1.95, "Recursão em submetas",
               "Para chegar ao grau 2 da mastite,\no motor descobre sozinho que\nprecisa antes perguntar o que\nestabelece o grau 1.", cor=TEAL_CLARO),
        cartao(s, 8.9, 4.05, 3.65, 1.95, "Custo da pergunta",
               "1 = observação direta\n3 = exige manejo\n5 = exame laboratorial\n\nPergunta barata vem primeiro.", cor=TEAL_CLARO),
    ]
    animar(s, [(x, "fade") for x in f] + [(x, "subir") for x in c])
    transicao(s, "push")
    nota(s, "Explicar que disparar uma regra por ciclo é o que faz a resolução de conflito ter efeito real.")

    # -------------------------------------------- 9. Fatores de certeza
    s = nova(prs, TEAL_ESCURO)
    f = titulo_slide(s, "Fatores de certeza", "Modelo MYCIN — como a evidência se acumula, passo a passo", escuro=True)
    codigo = caixa_codigo(s, 0.8, 2.15, 7.4, 4.1, [
        ("Vaca com grumos no leite, úbere dolorido e inchado, sem febre", True),
        ("", False),
        ("1. MAST-CLIN-G1", True),
        ("   premissa: alguma(grumos = sim [+1,00])        → max = 1,00", False),
        ("   conclusão: CF = 0,95 × 1,00                   = 0,95", False),
        ("", False),
        ("2. MAST-CLIN-G2", True),
        ("   premissa: todas( grau 1 → 0,95 ; dor → 1,00 ) → min = 0,95", False),
        ("   conclusão: CF = 0,90 × 0,95                   = 0,855", False),
        ("", False),
        ("3. MAST-CLIN-G3 fica PENDENTE", True),
        ("   febre = não, apetite = não, desidratação = ?, apatia = ?", False),
        ("   A disjunção não resolve → o motor PERGUNTA em vez de concluir.", False),
    ], tamanho=12.5)
    lado = [
        cartao(s, 8.6, 2.15, 3.95, 1.3, "Resultado", "Mastite clínica grau 2\nCF 0,855 — “Muito provável”", cor=VERDE, escuro=True),
        cartao(s, 8.6, 3.6, 3.95, 1.25, "Conjunção e disjunção", "min sobre E · max sobre OU\nlimiar de corte 0,2", cor=VERDE, escuro=True),
        cartao(s, 8.6, 5.0, 3.95, 1.25, "Subsunção", "O grau 2 substitui o grau 1\nno ranking — e o traço\npreserva a cadeia.", cor=VERDE, escuro=True),
    ]
    animar(s, [(x, "fade") for x in f] + [(codigo, "revelar")] + [(x, "entrar_direita") for x in lado])
    transicao(s, "fade")
    nota(s, "Este é o slide que prova domínio técnico. Percorrer o cálculo com o dedo na tela.")

    # ------------------------------------------- 10. Não sei ≠ Não
    s = nova(prs, BRANCO)
    f = titulo_slide(s, "“Não sei” não é “não”", "A distinção que separa um sistema especialista de um formulário")
    c = [
        cartao(s, 0.8, 2.3, 3.85, 1.6, "Sim", "valor = verdadeiro\nconfiança = 1,0", cor=VERDE_ESCURO),
        cartao(s, 4.85, 2.3, 3.85, 1.6, "Não", "valor = falso\nconfiança = 1,0", cor=TEAL),
        cartao(s, 8.9, 2.3, 3.65, 1.6, "Não sei", "NADA é gravado.\nA regra fica pendente.", cor=ATENCAO),
    ]
    destaque = retangulo(s, 0.8, 4.3, L - 1.6, 1.75, preenchimento=RGBColor(0xFC, 0xEA, 0xE7), contorno=ALERTA)
    tf = destaque.text_frame
    tf.margin_left = Inches(0.3); tf.margin_top = Inches(0.22)
    p = tf.paragraphs[0]
    r = p.add_run(); r.text = "Se a ausência de informação virasse “não”, o sistema concluiria “sem alteração” com alta confiança a partir de um questionário mal respondido."
    r.font.size = Pt(14); r.font.bold = True; r.font.color.rgb = PRETO; r.font.name = FONTE
    p = tf.add_paragraph(); p.space_before = Pt(8)
    r = p.add_run()
    r.text = "Em triagem veterinária, isso é o pior erro possível: um falso negativo confiante. O motor prefere perguntar."
    r.font.size = Pt(12); r.font.color.rgb = CINZA; r.font.name = FONTE
    animar(s, [(x, "fade") for x in f] + [(x, "subir") for x in c] + [(destaque, "revelar")])
    transicao(s, "push")
    nota(s, "Pergunta provável da banca: 'e se o produtor não souber responder?' — a resposta está aqui.")

    # ----------------------------------------------- 11. Explicabilidade
    s = nova(prs, BRANCO)
    f = titulo_slide(s, "Explicabilidade", "O módulo de explicação responde às duas perguntas do modelo conceitual")
    a = cartao(s, 0.8, 2.15, 5.85, 3.9, "“Por que essa pergunta?”",
               "Durante o questionário, o app lista as regras pendentes que\n"
               "dependem da variável perguntada e as hipóteses que elas\n"
               "sustentam.\n\n"
               "“Estou perguntando sobre febre porque isso separa a mastite\n"
               "clínica grau 2 do grau 3 — e no grau 3 a vaca corre risco\n"
               "de morrer.”", cor=TEAL)
    b = cartao(s, 6.95, 2.15, 5.6, 3.9, "“Como cheguei nisso?”",
               "No parecer, a cadeia completa é reconstruída de trás para\n"
               "frente: regra → premissas → fatos → regras que produziram\n"
               "aqueles fatos, recursivamente.\n\n"
               "Cada etapa mostra o fator de certeza e a FONTE.\n"
               "O traço inteiro é gravado no prontuário e exportável.", cor=TEAL)
    rod = rodape(s, "O prontuário guarda a versão da base e do motor. Ao reabrir, o app re-executa a inferência — e avisa se a base mudou desde o atendimento.")
    animar(s, [(x, "fade") for x in f] + [(a, "entrar_esquerda"), (b, "entrar_direita"), (rod, "fade")])
    transicao(s, "push")
    nota(s, "Amarrar com o slide 14 do Hackathon: 'módulo de explicação responde por quê e como'.")

    # ------------------------------------------------------------ 12. DEMO
    s = nova(prs, TEAL)
    faixa(s, 0, 0, L, 0.1, VERDE)
    t1 = texto(s, 0, 1.15, L, 1.0, "DEMONSTRAÇÃO", tamanho=46, cor=BRANCO, negrito=True, alinhamento=PP_ALIGN.CENTER)
    t2 = texto(s, 0, 2.15, L, 0.5, "rodando em localhost, offline", tamanho=16, cor=VERDE, alinhamento=PP_ALIGN.CENTER)
    passos = []
    roteiro = [
        ("1", "Dashboard", "alertas, metas\ne carência"),
        ("2", "Anamnese", "“o que eu já sei”\n+ por que essa pergunta"),
        ("3", "Grau 1 → grau 3", "bandeira vermelha\ninterrompe tudo"),
        ("4", "Como cheguei nisso", "traço completo\ncom as fontes"),
        ("5", "Prontuário", "reabre e reproduz\no mesmo parecer"),
        ("6", "Base + testes", "28 casos rodando\nao vivo na tela"),
    ]
    x = 0.8
    for num, titulo, desc in roteiro:
        card = cartao(s, x, 3.2, 1.95, 2.0, f"{num}.  {titulo}", desc, cor=VERDE, escuro=True, tamanho_titulo=13)
        passos.append(card)
        x += 2.05
    animar(s, [(t1, "ampliar"), (t2, "fade")] + [(p, "subir") for p in passos], intervalo=180)
    transicao(s, "fade", "slow")
    nota(s, "Trocar para o navegador em localhost:8081. Seguir o roteiro na ordem. "
            "Se algo falhar: Configurações > Recriar dados de demonstração.")

    # -------------------------------------------------------- 13. Validação
    s = nova(prs, BRANCO)
    f = titulo_slide(s, "Validação", "“Defina casos de teste com resultado esperado” — diretriz do regulamento")
    nums = []
    nums += numerao(s, 0.8, 2.05, 2.9, "28", "casos de teste com\nresultado esperado", cor=VERDE_ESCURO)
    nums += numerao(s, 3.9, 2.05, 2.9, "81", "testes automatizados\nno total", cor=VERDE_ESCURO)
    nums += numerao(s, 7.0, 2.05, 2.9, "< 1s", "para rodar a suíte\ncompleta", cor=VERDE_ESCURO)
    nums += numerao(s, 10.1, 2.05, 2.45, "100%", "passando na\nbase v1.0.0", cor=VERDE_ESCURO)
    c = [
        cartao(s, 0.8, 4.05, 3.85, 2.0, "Cobertura",
               "Os 3 graus clínicos · subclínica por CMT\nem cada nível e por CCS · crônica ·\n"
               "peito perdido · notificação obrigatória ·\n2 casos NEGATIVOS · 1 caso ambíguo", cor=TEAL),
        cartao(s, 4.85, 4.05, 3.85, 2.0, "Rodam em três lugares",
               "1. na suíte automatizada\n2. no CI local antes de mexer na base\n"
               "3. DENTRO DO APP, na tela da base\n    de conhecimento", cor=TEAL),
        cartao(s, 8.9, 4.05, 3.65, 2.0, "Banco testado de verdade",
               "O backend do SQLite é injetável:\no esquema, o seed e as consultas\n"
               "rodam contra um SQLite real,\nsem navegador e sem aparelho.", cor=TEAL),
    ]
    animar(s, [(x, "fade") for x in f] + [(n, "subir") for n in nums] + [(x, "subir") for x in c])
    transicao(s, "push")
    nota(s, "Oferecer rodar os casos ao vivo na tela da base de conhecimento.")

    # ------------------------------------------------- 14. Reproduz a cartilha
    s = nova(prs, BRANCO)
    f = titulo_slide(s, "Os números batem com a cartilha", "A suíte reproduz o exemplo publicado da propriedade do Sr. João")
    codigo = caixa_codigo(s, 0.8, 2.1, 7.0, 4.0, [
        ("custo por litro                    R$ 0,593   ✓", False),
        ("diferença preço − custo            R$ 0,477   ✓", False),
        ("custo operacional total         R$ 17.463,00   ✓", False),
        ("custo operacional por litro        R$ 0,957   ✓", False),
        ("margem líquida                   R$ 5.074,00   ✓", False),
        ("leite por vaca em lactação          18,4 L/d   ✓", False),
        ("% de vacas em lactação                   76%   ✓", False),
        ("% de vacas no rebanho                  46,2%   ✓", False),
        ("leite por mão de obra por dia          294 L   ✓", False),
        ("leite por área por ano             4.563 L/ha   ✓", False),
        ("% de mastite clínica (exemplo p. 38)    4,8%   ✓", True),
    ], escuro=False, tamanho=12.5)
    lado = cartao(s, 8.2, 2.1, 4.35, 4.0, "E duas divergências na própria cartilha",
                  "1. Produção mensal: a cartilha manda somar\n"
                  "    15416+434+2120+279 e imprime 18.251.\n"
                  "    A soma dá 18.249.\n\n"
                  "2. Margem bruta: imprime 12.636, o que exigiria\n"
                  "    receitas de 23.459 — mas as receitas que ela\n"
                  "    própria detalha somam 22.537, e é esse valor\n"
                  "    que reproduz a margem líquida publicada.\n\n"
                  "Mantivemos as fórmulas corretas e documentamos.", cor=ATENCAO)
    animar(s, [(x, "fade") for x in f] + [(codigo, "revelar"), (lado, "entrar_direita")])
    transicao(s, "push")
    nota(s, "Encontrar erro na fonte mostra que os cálculos foram realmente conferidos, não copiados.")

    # ---------------------------------------------------- 15. Impacto
    s = nova(prs, BRANCO)
    f = titulo_slide(s, "Da anamnese ao bolso do produtor", "O que liga o diagnóstico ao resultado da propriedade")
    c = [
        cartao(s, 0.8, 2.15, 3.85, 2.05, "Margem por vaca",
               "Receita do leite aproveitado,\nmenos o custo dos tratamentos,\n"
               "menos o leite descartado\npor carência.", cor=VERDE_ESCURO),
        cartao(s, 4.85, 2.15, 3.85, 2.05, "Carência automática",
               "Registrar uma aplicação bloqueia\no leite, cria o evento de fim de\n"
               "carência e lança a despesa em\n“Sanidade e medicamentos”.", cor=TEAL),
        cartao(s, 8.9, 2.15, 3.65, 2.05, "Metas da Embrapa",
               "% de mastite clínica e subclínica\ncalculados pelas fórmulas da\n"
               "cartilha, comparados às metas\nde 2% e 20%.", cor=TEAL),
    ]
    destaque = retangulo(s, 0.8, 4.55, L - 1.6, 1.5, preenchimento=CREME, contorno=TEAL)
    tf = destaque.text_frame
    tf.margin_left = Inches(0.3); tf.margin_top = Inches(0.22)
    p = tf.paragraphs[0]
    r = p.add_run(); r.text = "O financeiro usa as categorias e os indicadores exatos da planilha da Embrapa — a mesma que o produtor já conhece."
    r.font.size = Pt(14); r.font.bold = True; r.font.color.rgb = PRETO; r.font.name = FONTE
    p = tf.add_paragraph(); p.space_before = Pt(7)
    r = p.add_run(); r.text = "Identificar mastite cedo deixa de ser recomendação técnica e vira um número em reais na tela."
    r.font.size = Pt(12); r.font.color.rgb = CINZA; r.font.name = FONTE
    animar(s, [(x, "fade") for x in f] + [(x, "subir") for x in c] + [(destaque, "revelar")])
    transicao(s, "push")
    nota(s, "Fechar o argumento: o produtor adota o que ele enxerga que dá dinheiro.")

    # ------------------------------------------------- 16. Processo com IA
    s = nova(prs, BRANCO)
    f = titulo_slide(s, "O processo com a IA", "Onde ela ajudou, onde errou, e o que foi preciso entender para corrigir")
    a = cartao(s, 0.8, 2.1, 5.85, 1.5, "A correção que definiu o projeto",
               "O rascunho inicial descrevia “algoritmos que fazem perguntas” — um formulário\n"
               "ramificado. A leitura do regulamento mostrou que o pedido era outro.", cor=VERDE_ESCURO)
    erros = [
        cartao(s, 0.8, 3.8, 2.9, 2.3, "1. Backward chaining\nsem recursão",
               "Queria perguntar “a mama\nestá dolorida?” antes de\n“o leite tem grumos?”.\n\nOrdem clinicamente errada.", cor=ALERTA, tamanho_titulo=13),
        cartao(s, 3.9, 3.8, 2.9, 2.3, "2. Aspas duplas\nem SQL",
               "Em SQLite, aspas duplas são\nidentificadores. A busca do\nrebanho quebraria na\nprimeira palavra digitada.", cor=ALERTA, tamanho_titulo=13),
        cartao(s, 7.0, 3.8, 2.9, 2.3, "3. Subsunção\nausente",
               "O grau 1 ranqueava acima\ndo grau 2. A tentação era\nmexer nos CF — seria errado:\nCF é certeza, não gravidade.", cor=ALERTA, tamanho_titulo=13),
        cartao(s, 10.1, 3.8, 2.45, 2.3, "4. WebAssembly\nfora do pacote",
               "O app empacotado abriria\nsem banco. Só apareceu\nporque rodamos o export\nde produção.", cor=ALERTA, tamanho_titulo=13),
    ]
    b = cartao(s, 6.95, 2.1, 5.6, 1.5, "Todos encontrados por teste",
               "Nenhum desses quatro apareceu em revisão visual. Três quebrariam a\n"
               "demonstração ao vivo.", cor=ATENCAO)
    animar(s, [(x, "fade") for x in f] + [(a, "entrar_esquerda"), (b, "entrar_direita")] + [(e, "subir") for e in erros])
    transicao(s, "push")
    nota(s, "Mostrar os erros é mais convincente do que escondê-los: prova que entendemos o que foi produzido.")

    # ----------------------------------------------------------- 17. Limites
    s = nova(prs, BRANCO)
    f = titulo_slide(s, "O que o Dr. Moo NÃO faz", "Declarar o limite é parte da entrega")
    c = [
        cartao(s, 0.8, 2.2, 3.85, 1.7, "Não prescreve", "Nenhum medicamento,\nnenhuma dose.", cor=ALERTA),
        cartao(s, 4.85, 2.2, 3.85, 1.7, "Não diagnostica", "Faz TRIAGEM explicável.\nNão fecha diagnóstico.", cor=ALERTA),
        cartao(s, 8.9, 2.2, 3.65, 1.7, "Não substitui o veterinário", "Todo parecer termina\ncom esse aviso.", cor=ALERTA),
        cartao(s, 0.8, 4.1, 3.85, 1.9, "Próximos passos",
               "Validar os grupos clínicos 03–09\ncom médico-veterinário e\npromovê-los a “validada”.", cor=TEAL_CLARO),
        cartao(s, 4.85, 4.1, 3.85, 1.9, "Rede local",
               "Hoje é tela protótipo, declarada\ncomo tal no próprio app.\nO desenho está documentado.", cor=TEAL_CLARO),
        cartao(s, 8.9, 4.1, 3.65, 1.9, "Fora de escopo",
               "Formulação de dietas (T2) e\nanálise econômica avançada (T3)\n— são os outros temas.", cor=TEAL_CLARO),
    ]
    animar(s, [(x, "fade") for x in f] + [(x, "subir") for x in c])
    transicao(s, "push")
    nota(s, "Não prometer o que não existe. A banca percebe, e isso custa caro.")

    # --------------------------------------------------------- 17b. Deploy
    s = nova(prs, BRANCO)
    f = titulo_slide(s, "Deploy e integração contínua", "Dois workflows do GitHub Actions cobrem verificação e publicação")
    codigo = caixa_codigo(s, 0.8, 2.15, 7.1, 4.15, [
        ("verificar.yml", True),
        ("on: push (qualquer branch) e pull_request", False),
        ("  npm ci", False),
        ("  npm run typecheck && npm run test", False),
        ("", False),
        ("publicar-web.yml", True),
        ("on: push na main (ou disparo manual)", False),
        ("  npm ci && npm run verify", False),
        ("  npm run build:web", False),
        ("  ajustar baseUrl → /hackaton-gado-de-leite/app", False),
        ("  actions/deploy-pages@v4", False),
    ], tamanho=13)
    lado = [
        cartao(s, 8.15, 2.15, 4.4, 1.9, "Falhar aqui é melhor",
               "`verificar.yml` roda em menos de\n2 minutos a cada push — é o que\nimpede a base, o motor ou a\nplanilha quebrarem sem ninguém\nperceber.", cor=TEAL),
        cartao(s, 8.15, 4.3, 4.4, 1.95, "Zero servidor no ar",
               "`publicar-web.yml` exporta o app\nestático e publica no GitHub Pages\na cada merge. O banco SQLite\ncontinua rodando no navegador\nde quem acessa.", cor=VERDE_ESCURO),
    ]
    animar(s, [(x, "fade") for x in f] + [(codigo, "revelar")] + [(x, "subir") for x in lado])
    transicao(s, "push")
    nota(s, "Mostrar a aba Actions do GitHub ao vivo, se der tempo: os dois workflows rodando verde.")

    # --------------------------------------------------------- 17c. QR codes
    s = nova(prs, TEAL)
    faixa(s, 0, 0, L, 0.1, VERDE)
    t1 = texto(s, 0, 0.75, L, 0.8, "Acesse agora", tamanho=38, cor=BRANCO, negrito=True, alinhamento=PP_ALIGN.CENTER)
    t2 = texto(s, 0, 1.55, L, 0.5, "Um já está no ar. O outro aponta para onde vai estar.",
               tamanho=15, cor=RGBColor(0xBF, 0xE3, 0xE7), alinhamento=PP_ALIGN.CENTER)
    blocos = []
    for cx, qr, rotulo, url in [
        (2.9, QR_SITE, "Site  ·  GitHub Pages", "nathantostes.github.io/hackaton-gado-de-leite"),
        (7.9, QR_PLAY, "App  ·  Play Store", "redireciona para a Play Store — publicação em andamento"),
    ]:
        cartao_fundo = retangulo(s, cx, 2.5, 3.5, 4.1, preenchimento=BRANCO, contorno=None, raio=0.05)
        blocos.append(cartao_fundo)
        if qr.exists():
            tam = 2.6
            img = s.shapes.add_picture(str(qr), Inches(cx + (3.5 - tam) / 2), Inches(2.75), height=Inches(tam))
            blocos.append(img)
        blocos.append(texto(s, cx + 0.15, 5.55, 3.2, 0.4, rotulo, tamanho=15, cor=TEAL, negrito=True, alinhamento=PP_ALIGN.CENTER))
        blocos.append(texto(s, cx + 0.15, 5.95, 3.2, 0.5, url, tamanho=10.5, cor=RGBColor(0xC3, 0xDC, 0xE0),
                             alinhamento=PP_ALIGN.CENTER, entrelinha=1.2))
    animar(s, [(t1, "ampliar"), (t2, "fade")] + [(b, "subir") for b in blocos], intervalo=180)
    transicao(s, "fade", "slow")
    nota(s, "Deixar este slide no ar um pouco mais — é o momento de a banca escanear com o celular.")

    # ------------------------------------------------------ 18. Encerramento
    s = nova(prs, TEAL)
    faixa(s, 0, 0, L, 0.1, VERDE)
    t1 = texto(s, 0, 1.6, L, 0.9, "Dr. Moo", tamanho=52, cor=BRANCO, negrito=True, alinhamento=PP_ALIGN.CENTER)
    t2 = texto(s, 1.5, 2.65, L - 3, 1.0,
               "Base de conhecimento explícita · motor de inferência determinístico\n"
               "explicação auditável · roda por completo em localhost",
               tamanho=16, cor=RGBColor(0xBF, 0xE3, 0xE7), alinhamento=PP_ALIGN.CENTER, entrelinha=1.3)
    b = faixa(s, L / 2 - 1.1, 3.95, 2.2, 0.035, VERDE)
    t3 = texto(s, 0, 4.3, L, 1.4,
               "git clone  →  npm install  →  npm run dev\nhttp://localhost:8081",
               tamanho=17, cor=VERDE, alinhamento=PP_ALIGN.CENTER, fonte=FONTE_MONO, entrelinha=1.5)
    t4 = texto(s, 0, 6.1, L, 0.6, "Obrigado.", tamanho=20, cor=BRANCO, negrito=True, alinhamento=PP_ALIGN.CENTER)
    animar(s, [(t1, "ampliar"), (t2, "fade"), (b, "revelar"), (t3, "subir"), (t4, "fade")], intervalo=280)
    transicao(s, "fade", "slow")
    nota(s, "Agradecer e abrir para perguntas. Deixar o app aberto no notebook.")

    return prs


def main() -> None:
    prs = construir()
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    prs.save(SAIDA)
    tamanho = SAIDA.stat().st_size / 1024
    print(f"{SAIDA.relative_to(RAIZ)} · {len(prs.slides.__iter__.__self__._sldIdLst)} slides · {tamanho:.0f} KB")


if __name__ == "__main__":
    main()
