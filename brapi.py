#!/usr/bin/env python3
"""
Módulo de integração com a API brapi.dev
Fornece dados complementares de ações brasileiras
"""

import urllib.request
import json
from typing import Dict, Optional, List
from decimal import Decimal

# URL base da API
BRAPI_BASE_URL = "https://brapi.dev/api"


def fetch_quote(ticker: str, modules: List[str] = None) -> Optional[Dict]:
    """
    Busca dados de uma ação específica na brapi.dev

    Args:
        ticker: Código da ação (ex: ITUB4, PETR4)
        modules: Lista de módulos adicionais (summaryProfile, balanceSheetHistory, etc.)

    Returns:
        Dicionário com os dados da ação ou None se houver erro
    """
    try:
        url = f"{BRAPI_BASE_URL}/quote/{ticker}"

        if modules:
            modules_param = ",".join(modules)
            url += f"?modules={modules_param}"

        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))

            if 'results' in data and len(data['results']) > 0:
                return data['results'][0]

    except Exception as e:
        print(f"Erro ao buscar {ticker}: {e}")

    return None


def fetch_multiple_quotes(tickers: List[str]) -> Dict[str, Dict]:
    """
    Busca dados de múltiplas ações de uma vez

    Args:
        tickers: Lista de códigos de ações

    Returns:
        Dicionário com ticker como chave e dados como valor
    """
    results = {}

    # A API suporta múltiplos tickers separados por vírgula
    try:
        tickers_param = ",".join(tickers[:20])  # Limita a 20 por requisição
        url = f"{BRAPI_BASE_URL}/quote/{tickers_param}"

        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        )

        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))

            if 'results' in data:
                for item in data['results']:
                    if 'symbol' in item:
                        results[item['symbol']] = item

    except Exception as e:
        print(f"Erro ao buscar múltiplos tickers: {e}")

    return results


def get_detailed_stock_data(ticker: str) -> Optional[Dict]:
    """
    Busca dados detalhados de uma ação incluindo perfil e dividendos

    Args:
        ticker: Código da ação

    Returns:
        Dicionário com dados completos ou None
    """
    modules = [
        'summaryProfile',
        'defaultKeyStatistics',
        'financialData'
    ]

    return fetch_quote(ticker, modules)


def format_brapi_data(raw_data: Dict) -> Dict:
    """
    Formata os dados da brapi para um formato padronizado

    Args:
        raw_data: Dados brutos da API

    Returns:
        Dicionário com dados formatados
    """
    if not raw_data:
        return {}

    formatted = {
        # Dados básicos
        'symbol': raw_data.get('symbol', ''),
        'shortName': raw_data.get('shortName', ''),
        'longName': raw_data.get('longName', ''),
        'currency': raw_data.get('currency', 'BRL'),

        # Preços
        'regularMarketPrice': raw_data.get('regularMarketPrice'),
        'regularMarketDayHigh': raw_data.get('regularMarketDayHigh'),
        'regularMarketDayLow': raw_data.get('regularMarketDayLow'),
        'regularMarketOpen': raw_data.get('regularMarketOpen'),
        'regularMarketPreviousClose': raw_data.get('regularMarketPreviousClose'),
        'regularMarketChange': raw_data.get('regularMarketChange'),
        'regularMarketChangePercent': raw_data.get('regularMarketChangePercent'),

        # Volume e Market Cap
        'regularMarketVolume': raw_data.get('regularMarketVolume'),
        'marketCap': raw_data.get('marketCap'),

        # 52 semanas
        'fiftyTwoWeekHigh': raw_data.get('fiftyTwoWeekHigh'),
        'fiftyTwoWeekLow': raw_data.get('fiftyTwoWeekLow'),

        # Médias móveis
        'fiftyDayAverage': raw_data.get('fiftyDayAverage'),
        'twoHundredDayAverage': raw_data.get('twoHundredDayAverage'),

        # Dados de perfil (se disponível)
        'sector': raw_data.get('summaryProfile', {}).get('sector', ''),
        'industry': raw_data.get('summaryProfile', {}).get('industry', ''),
        'website': raw_data.get('summaryProfile', {}).get('website', ''),
        'longBusinessSummary': raw_data.get('summaryProfile', {}).get('longBusinessSummary', ''),

        # Indicadores (se disponível)
        'earningsPerShare': raw_data.get('earningsPerShare'),
        'priceToEarnings': raw_data.get('priceEarnings'),
    }

    return {k: v for k, v in formatted.items() if v is not None}


def get_available_tickers() -> List[str]:
    """
    Retorna lista de tickers disponíveis na brapi

    Returns:
        Lista de códigos de ações
    """
    try:
        url = f"{BRAPI_BASE_URL}/quote/list"

        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))

            if 'stocks' in data:
                return [stock['stock'] for stock in data['stocks']]

    except Exception as e:
        print(f"Erro ao buscar lista de tickers: {e}")

    return []


def fetch_indices() -> Dict[str, Dict]:
    """
    Busca dados dos principais índices e moedas

    Returns:
        Dicionário com dados de IBOV, IFIX, USD/BRL, etc.
    """
    # Símbolos dos índices na brapi
    # ^BVSP = Ibovespa, USDBRL=X = Dólar
    indices_map = {
        '^BVSP': 'IBOV',
        'USDBRL=X': 'USD/BRL',
    }

    results = {}

    for symbol, name in indices_map.items():
        try:
            url = f"{BRAPI_BASE_URL}/quote/{symbol}"

            req = urllib.request.Request(
                url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                }
            )

            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))

                if 'results' in data and len(data['results']) > 0:
                    item = data['results'][0]
                    results[name] = {
                        'symbol': symbol,
                        'name': name,
                        'price': item.get('regularMarketPrice'),
                        'change': item.get('regularMarketChange'),
                        'changePercent': item.get('regularMarketChangePercent'),
                        'previousClose': item.get('regularMarketPreviousClose')
                    }

        except Exception as e:
            print(f"Erro ao buscar índice {symbol}: {e}")

    # Adiciona SELIC e IFIX com valores fixos (não disponíveis na brapi gratuita)
    # Em produção, esses valores seriam buscados de outra API
    results['SELIC'] = {
        'symbol': 'SELIC',
        'name': 'SELIC',
        'price': 11.25,
        'change': 0,
        'changePercent': 0,
        'note': 'Taxa anual'
    }

    results['IFIX'] = {
        'symbol': 'IFIX',
        'name': 'IFIX',
        'price': None,
        'change': None,
        'changePercent': None,
        'note': 'Dados não disponíveis'
    }

    return results


if __name__ == '__main__':
    # Teste básico
    print("Testando API brapi.dev...")

    # Teste com ITUB4
    data = fetch_quote('ITUB4')
    if data:
        print(f"\nDados de ITUB4:")
        print(f"  Nome: {data.get('longName', 'N/A')}")
        print(f"  Preço: R$ {data.get('regularMarketPrice', 'N/A')}")
        print(f"  Variação: {data.get('regularMarketChangePercent', 'N/A'):.2f}%")
        print(f"  Market Cap: {data.get('marketCap', 'N/A')}")
    else:
        print("Não foi possível obter dados de ITUB4")

    # Teste com múltiplos tickers
    print("\nTestando múltiplos tickers...")
    multi_data = fetch_multiple_quotes(['PETR4', 'VALE3', 'ITUB4'])
    for ticker, info in multi_data.items():
        print(f"  {ticker}: R$ {info.get('regularMarketPrice', 'N/A')}")
