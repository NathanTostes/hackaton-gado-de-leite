#!/usr/bin/env python3
"""
Exporta os modelos de `gerar_diagrama_classes.py` para um projeto StarUML (.mdj).

O .mdj é JSON: um `Project` com um `UMLModel` dentro, as classes como
`UMLClass` (com `UMLAttribute` e `UMLOperation`), as ligações como
`UMLAssociation` / `UMLGeneralization` / `UMLDependency`, e um
`UMLClassDiagram` por figura com as caixas já posicionadas — as mesmas
coordenadas usadas para desenhar os PNGs, convertidas de polegadas para pixels
e com o eixo Y invertido (matplotlib cresce para cima, StarUML para baixo).

Usado por `scripts/gerar_diagrama_classes.py`; não precisa ser chamado direto.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

PIXEIS_POR_POLEGADA = 96
FONTE_MDJ = "Arial;13;0"

# Altura das faixas da caixa, em pixels, do jeito que o StarUML desenha.
ALTURA_NOME = 25
ALTURA_ITEM = 18


def _slug(texto: str) -> str:
    """Id legível e estável — o StarUML aceita qualquer string como `_id`."""
    return re.sub(r"[^A-Za-z0-9]+", "-", texto).strip("-")


def _visibilidade(texto: str) -> tuple[str, str]:
    """Separa o marcador UML (`+`, `-`, `#`) do resto da linha."""
    marcadores = {"+": "public", "-": "private", "#": "protected", "~": "package"}
    texto = texto.strip()
    if texto[:1] in marcadores:
        return marcadores[texto[0]], texto[1:].strip()
    return "public", texto


def _atributo(linha: str, pai: str, indice: int) -> dict[str, Any]:
    """Converte `+ brinco: string «único»` num UMLAttribute."""
    visibilidade, corpo = _visibilidade(linha)
    nome, _, tipo = corpo.partition(":")
    nome = nome.strip()
    tipo = tipo.strip()
    # Anotações entre «guillemets» não são tipo: viram documentação do atributo.
    anotacoes = " ".join(re.findall(r"«([^»]+)»", tipo))
    if anotacoes:
        tipo = re.sub(r"«[^»]+»", "", tipo).strip()
    multiplicidade = ""
    if nome.endswith("?"):
        # `nome?: tipo` em TypeScript é 0..1 em UML.
        nome = nome[:-1]
        multiplicidade = "0..1"
    if tipo.endswith("[]"):
        tipo, multiplicidade = tipo[:-2], "*"
    atributo: dict[str, Any] = {
        "_type": "UMLAttribute",
        "_id": f"{pai}-atr-{indice}",
        "_parent": {"$ref": pai},
        "name": nome or corpo,
        "visibility": visibilidade,
    }
    if tipo:
        atributo["type"] = tipo
    if multiplicidade:
        atributo["multiplicity"] = multiplicidade
    if anotacoes:
        atributo["documentation"] = anotacoes
    return atributo


def _operacao(linha: str, pai: str, indice: int) -> dict[str, Any]:
    """Converte `+ proximo(): ProximoPasso` num UMLOperation com retorno."""
    visibilidade, corpo = _visibilidade(linha)
    assinatura, _, retorno = corpo.rpartition(":") if "):" in corpo else (corpo, "", "")
    nome = assinatura.split("(")[0].strip() or corpo
    parametros_crus = ""
    if "(" in assinatura and ")" in assinatura:
        parametros_crus = assinatura[assinatura.index("(") + 1 : assinatura.rindex(")")]

    operacao: dict[str, Any] = {
        "_type": "UMLOperation",
        "_id": f"{pai}-ope-{indice}",
        "_parent": {"$ref": pai},
        "name": nome,
        "visibility": visibilidade,
        "parameters": [],
    }
    for i, bruto in enumerate(p.strip() for p in parametros_crus.split(",")):
        if not bruto:
            continue
        pnome, _, ptipo = bruto.partition(":")
        parametro: dict[str, Any] = {
            "_type": "UMLParameter",
            "_id": f"{operacao['_id']}-par-{i}",
            "_parent": {"$ref": operacao["_id"]},
            "name": pnome.strip().rstrip("?"),
        }
        if ptipo.strip():
            parametro["type"] = ptipo.strip()
        operacao["parameters"].append(parametro)

    retorno = retorno.strip()
    if retorno:
        operacao["parameters"].append(
            {
                "_type": "UMLParameter",
                "_id": f"{operacao['_id']}-ret",
                "_parent": {"$ref": operacao["_id"]},
                "name": "",
                "type": retorno,
                "direction": "return",
            }
        )
    return operacao


def _classe(classe, pai: str, prefixo: str) -> dict[str, Any]:
    ident = f"{prefixo}-{_slug(classe.nome)}"
    elemento: dict[str, Any] = {
        "_type": "UMLClass",
        "_id": ident,
        "_parent": {"$ref": pai},
        "name": classe.nome,
        "attributes": [_atributo(a, ident, i) for i, a in enumerate(classe.atributos)],
        "operations": [_operacao(o, ident, i) for i, o in enumerate(classe.operacoes)],
    }
    if classe.estereotipo:
        elemento["stereotype"] = classe.estereotipo.strip("«»")
    return elemento


def _relacao(relacao, pai: str, prefixo: str, ids: dict[str, str], indice: int) -> dict[str, Any]:
    de, para = ids[relacao.de], ids[relacao.para]
    ident = f"{prefixo}-rel-{indice}"

    if relacao.tipo == "heranca":
        return {
            "_type": "UMLGeneralization",
            "_id": ident,
            "_parent": {"$ref": pai},
            "name": relacao.rotulo,
            "source": {"$ref": para},
            "target": {"$ref": de},
        }
    if relacao.tipo == "dependencia":
        return {
            "_type": "UMLDependency",
            "_id": ident,
            "_parent": {"$ref": pai},
            "name": relacao.rotulo,
            "source": {"$ref": de},
            "target": {"$ref": para},
        }

    # Associação e composição são a mesma classe UML; muda a agregação da ponta.
    return {
        "_type": "UMLAssociation",
        "_id": ident,
        "_parent": {"$ref": pai},
        "name": relacao.rotulo,
        "end1": {
            "_type": "UMLAssociationEnd",
            "_id": f"{ident}-e1",
            "_parent": {"$ref": ident},
            "reference": {"$ref": de},
            "aggregation": "composite" if relacao.tipo == "composicao" else "none",
        },
        "end2": {
            "_type": "UMLAssociationEnd",
            "_id": f"{ident}-e2",
            "_parent": {"$ref": ident},
            "reference": {"$ref": para},
            "navigable": True,
            "multiplicity": "*" if relacao.tipo == "composicao" else "",
        },
    }


def _rotulo(ident: str, pai: str, modelo_ref: str, texto: str = "") -> dict[str, Any]:
    """Rótulo de aresta. O StarUML espera o campo presente mesmo quando vazio."""
    return {
        "_type": "EdgeLabelView",
        "_id": ident,
        "_parent": {"$ref": pai},
        "model": {"$ref": modelo_ref},
        "visible": bool(texto),
        "font": FONTE_MDJ,
        "alpha": 1.5707963267948966,
        "distance": 15,
        "hostEdge": {"$ref": pai},
        "edgePosition": 1,
        "text": texto,
    }


def _etiqueta(ident: str, pai: str, texto: str = "") -> dict[str, Any]:
    return {
        "_type": "LabelView",
        "_id": ident,
        "_parent": {"$ref": pai},
        "font": FONTE_MDJ,
        "visible": bool(texto),
        "text": texto,
    }


def _vista_classe(classe, elemento: dict[str, Any], diagrama: str, altura_total: float) -> dict[str, Any]:
    ident = f"v-{elemento['_id']}"
    largura = int(classe.calcular_largura() * PIXEIS_POR_POLEGADA)
    altura = int(classe.altura() * PIXEIS_POR_POLEGADA)
    esquerda = int(classe.x * PIXEIS_POR_POLEGADA)
    topo = int((altura_total - classe.y - classe.altura()) * PIXEIS_POR_POLEGADA)

    nome_id = f"{ident}-nc"
    atributos_id = f"{ident}-ac"
    operacoes_id = f"{ident}-oc"

    y_atributos = topo + ALTURA_NOME
    altura_atributos = ALTURA_ITEM * max(1, len(elemento["attributes"]))
    y_operacoes = y_atributos + altura_atributos

    return {
        "_type": "UMLClassView",
        "_id": ident,
        "_parent": {"$ref": diagrama},
        "model": {"$ref": elemento["_id"]},
        "left": esquerda,
        "top": topo,
        "width": largura,
        "height": altura,
        "fillColor": "#ffffff",
        "fontColor": "#000000",
        "suppressAttributes": False,
        "suppressOperations": False,
        "nameCompartment": {
            "_type": "UMLNameCompartmentView",
            "_id": nome_id,
            "_parent": {"$ref": ident},
            "model": {"$ref": elemento["_id"]},
            "left": esquerda,
            "top": topo,
            "width": largura,
            "height": ALTURA_NOME,
            "nameLabel": _etiqueta(f"{nome_id}-nome", nome_id, classe.nome),
            "stereotypeLabel": _etiqueta(
                f"{nome_id}-estereotipo", nome_id, elemento.get("stereotype", "")
            ),
            "namespaceLabel": _etiqueta(f"{nome_id}-namespace", nome_id),
            "propertyLabel": _etiqueta(f"{nome_id}-propriedades", nome_id),
        },
        "attributeCompartment": {
            "_type": "UMLAttributeCompartmentView",
            "_id": atributos_id,
            "_parent": {"$ref": ident},
            "model": {"$ref": elemento["_id"]},
            "left": esquerda,
            "top": y_atributos,
            "width": largura,
            "height": altura_atributos,
            "ownedViews": [
                {
                    "_type": "UMLAttributeView",
                    "_id": f"{atributos_id}-{i}",
                    "_parent": {"$ref": atributos_id},
                    "model": {"$ref": atributo["_id"]},
                    "font": FONTE_MDJ,
                    "height": ALTURA_ITEM,
                }
                for i, atributo in enumerate(elemento["attributes"])
            ],
        },
        "operationCompartment": {
            "_type": "UMLOperationCompartmentView",
            "_id": operacoes_id,
            "_parent": {"$ref": ident},
            "model": {"$ref": elemento["_id"]},
            "left": esquerda,
            "top": y_operacoes,
            "width": largura,
            "height": ALTURA_ITEM * max(1, len(elemento["operations"])),
            "ownedViews": [
                {
                    "_type": "UMLOperationView",
                    "_id": f"{operacoes_id}-{i}",
                    "_parent": {"$ref": operacoes_id},
                    "model": {"$ref": operacao["_id"]},
                    "font": FONTE_MDJ,
                    "height": ALTURA_ITEM,
                }
                for i, operacao in enumerate(elemento["operations"])
            ],
        },
        "receptionCompartment": {
            "_type": "UMLReceptionCompartmentView",
            "_id": f"{ident}-rc",
            "_parent": {"$ref": ident},
            "model": {"$ref": elemento["_id"]},
            "visible": False,
            "ownedViews": [],
        },
        "templateParameterCompartment": {
            "_type": "UMLTemplateParameterCompartmentView",
            "_id": f"{ident}-tpc",
            "_parent": {"$ref": ident},
            "model": {"$ref": elemento["_id"]},
            "visible": False,
            "ownedViews": [],
        },
    }


def _vista_relacao(relacao, elemento: dict[str, Any], diagrama: str, vistas: dict[str, str]) -> dict[str, Any]:
    ident = f"v-{elemento['_id']}"
    tipos = {
        "UMLAssociation": "UMLAssociationView",
        "UMLGeneralization": "UMLGeneralizationView",
        "UMLDependency": "UMLDependencyView",
    }
    # A generalização aponta do filho para o pai; o resto, da origem ao destino.
    if elemento["_type"] == "UMLGeneralization":
        cauda, cabeca = vistas[relacao.para], vistas[relacao.de]
    else:
        cauda, cabeca = vistas[relacao.de], vistas[relacao.para]

    vista: dict[str, Any] = {
        "_type": tipos[elemento["_type"]],
        "_id": ident,
        "_parent": {"$ref": diagrama},
        "model": {"$ref": elemento["_id"]},
        "tail": {"$ref": cauda},
        "head": {"$ref": cabeca},
        "lineStyle": 1,
        "points": "",
        "nameLabel": _rotulo(f"{ident}-nome", ident, elemento["_id"], relacao.rotulo),
        "stereotypeLabel": _rotulo(f"{ident}-estereotipo", ident, elemento["_id"]),
        "propertyLabel": _rotulo(f"{ident}-propriedades", ident, elemento["_id"]),
    }
    if elemento["_type"] == "UMLAssociation":
        for ponta, fim in (("tail", "end1"), ("head", "end2")):
            ref = elemento[fim]["_id"]
            vista[f"{ponta}RoleNameLabel"] = _rotulo(f"{ident}-{ponta}-papel", ident, ref)
            vista[f"{ponta}PropertyLabel"] = _rotulo(f"{ident}-{ponta}-prop", ident, ref)
            vista[f"{ponta}MultiplicityLabel"] = _rotulo(
                f"{ident}-{ponta}-mult", ident, ref, elemento[fim].get("multiplicity", "")
            )
    return vista


def exportar(modelos: list, saida: Path, documentacao: str = "") -> Path:
    """Escreve o projeto StarUML com um pacote e um diagrama por modelo."""
    projeto_id = "DrMoo"
    modelo_id = "DrMoo-Modelo"
    pacotes: list[dict[str, Any]] = []

    for modelo in modelos:
        prefixo = _slug(modelo.nome)
        pacote_id = f"pkg-{prefixo}"
        elementos = [_classe(c, pacote_id, prefixo) for c in modelo.classes]
        ids = {c.nome: e["_id"] for c, e in zip(modelo.classes, elementos)}
        ligacoes = [
            _relacao(r, pacote_id, prefixo, ids, i) for i, r in enumerate(modelo.relacoes)
        ]

        diagrama_id = f"dgm-{prefixo}"
        altura_total = max(c.y + c.altura() for c in modelo.classes)
        vistas_classe = [
            _vista_classe(c, e, diagrama_id, altura_total)
            for c, e in zip(modelo.classes, elementos)
        ]
        vistas = {c.nome: v["_id"] for c, v in zip(modelo.classes, vistas_classe)}
        vistas_relacao = [
            _vista_relacao(r, e, diagrama_id, vistas) for r, e in zip(modelo.relacoes, ligacoes)
        ]

        pacotes.append(
            {
                "_type": "UMLPackage",
                "_id": pacote_id,
                "_parent": {"$ref": modelo_id},
                "name": modelo.nome,
                "documentation": modelo.titulo,
                "ownedElements": [
                    *elementos,
                    *ligacoes,
                    {
                        "_type": "UMLClassDiagram",
                        "_id": diagrama_id,
                        "_parent": {"$ref": pacote_id},
                        "name": modelo.nome,
                        "defaultDiagram": prefixo == _slug(modelos[0].nome),
                        "ownedViews": [*vistas_classe, *vistas_relacao],
                    },
                ],
            }
        )

    projeto = {
        "_type": "Project",
        "_id": projeto_id,
        "name": "Dr. Moo",
        "author": "Hackathon UFJF 2026",
        "documentation": "Gerado por scripts/gerar_diagrama_classes.py a partir do código.",
        "ownedElements": [
            {
                "_type": "UMLModel",
                "_id": modelo_id,
                "_parent": {"$ref": projeto_id},
                "name": "Dr. Moo — modelo de classes",
                "documentation": documentacao.strip(),
                "ownedElements": pacotes,
            }
        ],
    }

    saida.parent.mkdir(parents=True, exist_ok=True)
    saida.write_text(json.dumps(projeto, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return saida
