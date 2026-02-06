#!/usr/bin/env python3
"""
Módulo para buscar notícias de sites financeiros brasileiros via RSS.
Usa xml.etree para evitar dependências externas.
"""

import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
import re
from html import unescape
from email.utils import parsedate_to_datetime

# Timezone do Brasil (UTC-3)
BRAZIL_TZ = timezone(timedelta(hours=-3))

# URLs dos feeds RSS
RSS_FEEDS = {
    'braziljournal': {
        'url': 'https://braziljournal.com/feed/',
        'name': 'Brazil Journal',
        'icon': 'BJ'
    },
    'seudinheiro': {
        'url': 'https://www.seudinheiro.com/feed/',
        'name': 'Seu Dinheiro',
        'icon': 'SD'
    },
    'infomoney': {
        'url': 'https://www.infomoney.com.br/feed/',
        'name': 'InfoMoney',
        'icon': 'IM'
    },
    'valor': {
        'url': 'https://valor.globo.com/rss/',
        'name': 'Valor Econômico',
        'icon': 'VE'
    },
    'neofeed': {
        'url': 'https://neofeed.com.br/feed/',
        'name': 'NeoFeed',
        'icon': 'NF'
    }
}


def clean_html(text: str) -> str:
    """Remove tags HTML e decodifica entidades."""
    if not text:
        return ''
    # Remove tags HTML
    clean = re.sub(r'<[^>]+>', '', text)
    # Decodifica entidades HTML
    clean = unescape(clean)
    # Remove espaços extras
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean


def parse_rss_date(date_str: str) -> Optional[datetime]:
    """Parseia data de RSS (formato RFC 2822) e converte para horário de Brasília."""
    if not date_str:
        return None

    try:
        # Tenta parsear como RFC 2822 (formato padrão de RSS)
        dt = parsedate_to_datetime(date_str)
        # Converte para horário de Brasília
        dt_brazil = dt.astimezone(BRAZIL_TZ)
        return dt_brazil
    except Exception:
        pass

    # Tenta outros formatos comuns
    formats = [
        '%Y-%m-%dT%H:%M:%S%z',
        '%Y-%m-%dT%H:%M:%SZ',
        '%Y-%m-%d %H:%M:%S',
        '%d/%m/%Y %H:%M:%S',
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            dt_brazil = dt.astimezone(BRAZIL_TZ)
            return dt_brazil
        except ValueError:
            continue

    return None


def get_element_text(item, tag: str) -> str:
    """Extrai texto de um elemento XML."""
    elem = item.find(tag)
    if elem is not None and elem.text:
        return elem.text.strip()
    return ''


def fetch_feed(source_key: str, limit: int = 5) -> List[Dict]:
    """Busca notícias de um feed RSS específico."""
    if source_key not in RSS_FEEDS:
        return []

    source = RSS_FEEDS[source_key]
    news_list = []

    try:
        req = urllib.request.Request(
            source['url'],
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml'
            }
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            content = response.read().decode('utf-8', errors='ignore')

        # Parse XML
        root = ET.fromstring(content)

        # Encontra itens (suporta RSS 2.0 e Atom)
        items = root.findall('.//item')
        if not items:
            items = root.findall('.//{http://www.w3.org/2005/Atom}entry')

        for item in items[:limit]:
            # Título
            title = get_element_text(item, 'title')
            if not title:
                title = get_element_text(item, '{http://www.w3.org/2005/Atom}title')
            title = clean_html(title)
            if not title:
                continue

            # Link
            link = get_element_text(item, 'link')
            if not link:
                link_elem = item.find('{http://www.w3.org/2005/Atom}link')
                if link_elem is not None:
                    link = link_elem.get('href', '')

            # Descrição/resumo
            summary = get_element_text(item, 'description')
            if not summary:
                summary = get_element_text(item, '{http://www.w3.org/2005/Atom}summary')
            if not summary:
                summary = get_element_text(item, '{http://purl.org/rss/1.0/modules/content/}encoded')
            summary = clean_html(summary)

            # Limita o resumo
            if len(summary) > 200:
                summary = summary[:197] + '...'

            # Data
            date_str = get_element_text(item, 'pubDate')
            if not date_str:
                date_str = get_element_text(item, '{http://www.w3.org/2005/Atom}published')
            if not date_str:
                date_str = get_element_text(item, '{http://www.w3.org/2005/Atom}updated')

            pub_date = parse_rss_date(date_str)
            formatted_date = ''
            timestamp = 0
            if pub_date:
                formatted_date = pub_date.strftime('%d/%m/%Y %H:%M')
                timestamp = pub_date.timestamp()

            # Categoria
            category = get_element_text(item, 'category')
            if not category:
                cat_elem = item.find('{http://www.w3.org/2005/Atom}category')
                if cat_elem is not None:
                    category = cat_elem.get('term', '')

            news_list.append({
                'title': title,
                'link': link,
                'summary': summary,
                'date': formatted_date,
                'timestamp': timestamp,
                'category': category,
                'source': source['name'],
                'source_key': source_key,
                'source_icon': source['icon']
            })

    except Exception as e:
        print(f"Erro ao buscar feed {source_key}: {e}")

    return news_list


def fetch_all_news(limit_per_source: int = 5) -> List[Dict]:
    """Busca notícias de todas as fontes e retorna ordenado por data."""
    all_news = []

    for source_key in RSS_FEEDS:
        news = fetch_feed(source_key, limit_per_source)
        all_news.extend(news)

    # Ordena por data (mais recente primeiro)
    all_news.sort(key=lambda x: x.get('timestamp', 0), reverse=True)

    return all_news


def fetch_news_by_sources(sources: List[str], limit_per_source: int = 5) -> List[Dict]:
    """Busca notícias de fontes específicas."""
    all_news = []

    for source_key in sources:
        if source_key in RSS_FEEDS:
            news = fetch_feed(source_key, limit_per_source)
            all_news.extend(news)

    # Ordena por data (mais recente primeiro)
    all_news.sort(key=lambda x: x.get('timestamp', 0), reverse=True)

    return all_news


def get_available_sources() -> Dict:
    """Retorna lista de fontes disponíveis."""
    return {key: {'name': val['name'], 'icon': val['icon']}
            for key, val in RSS_FEEDS.items()}


if __name__ == '__main__':
    # Teste
    print("Testando feeds RSS...")
    news = fetch_all_news(limit_per_source=3)
    for item in news[:10]:
        print(f"\n[{item['source']}] {item['title']}")
        print(f"  Data: {item['date']}")
        print(f"  Link: {item['link']}")
