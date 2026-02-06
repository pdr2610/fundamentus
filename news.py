#!/usr/bin/env python3
"""
Módulo para buscar notícias de sites financeiros brasileiros via RSS.
"""

import feedparser
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
import re
from html import unescape

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


def parse_date(entry) -> Optional[datetime]:
    """Tenta parsear a data de uma entrada RSS e converte para horário de Brasília."""
    parsed_time = None

    if hasattr(entry, 'published_parsed') and entry.published_parsed:
        try:
            parsed_time = entry.published_parsed
        except:
            pass

    if not parsed_time and hasattr(entry, 'updated_parsed') and entry.updated_parsed:
        try:
            parsed_time = entry.updated_parsed
        except:
            pass

    if parsed_time:
        try:
            # Cria datetime em UTC (feeds RSS geralmente estão em UTC)
            dt_utc = datetime(*parsed_time[:6], tzinfo=timezone.utc)
            # Converte para horário de Brasília
            dt_brazil = dt_utc.astimezone(BRAZIL_TZ)
            return dt_brazil
        except:
            pass

    return None


def fetch_feed(source_key: str, limit: int = 5) -> List[Dict]:
    """Busca notícias de um feed RSS específico."""
    if source_key not in RSS_FEEDS:
        return []

    source = RSS_FEEDS[source_key]
    news_list = []

    try:
        feed = feedparser.parse(source['url'])

        for entry in feed.entries[:limit]:
            # Título
            title = clean_html(entry.get('title', ''))
            if not title:
                continue

            # Link
            link = entry.get('link', '')

            # Descrição/resumo
            summary = ''
            if hasattr(entry, 'summary'):
                summary = clean_html(entry.summary)
            elif hasattr(entry, 'description'):
                summary = clean_html(entry.description)

            # Limita o resumo
            if len(summary) > 200:
                summary = summary[:197] + '...'

            # Data
            pub_date = parse_date(entry)
            date_str = ''
            if pub_date:
                date_str = pub_date.strftime('%d/%m/%Y %H:%M')

            # Categoria
            category = ''
            if hasattr(entry, 'tags') and entry.tags:
                category = entry.tags[0].get('term', '')
            elif hasattr(entry, 'category'):
                category = entry.category

            news_list.append({
                'title': title,
                'link': link,
                'summary': summary,
                'date': date_str,
                'timestamp': pub_date.timestamp() if pub_date else 0,
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
