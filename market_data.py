#!/usr/bin/env python3
"""
Módulo de dados de mercado usando fontes confiáveis:
- Banco Central do Brasil (BCB) para SELIC e câmbio
- Yahoo Finance para índices e ações
"""

import urllib.request
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional


# ========== BANCO CENTRAL DO BRASIL (BCB) ==========

def fetch_bcb_selic() -> Optional[Dict]:
    """
    Busca a taxa SELIC atual do Banco Central do Brasil.
    Série temporal 432 = SELIC meta definida pelo COPOM (% a.a.)
    """
    try:
        # API do BCB - últimos 5 valores da SELIC meta
        url = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/5?formato=json"

        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))

            if data and len(data) > 0:
                # Último valor
                latest = data[-1]
                return {
                    'value': float(latest['valor']),
                    'date': latest['data'],
                    'source': 'BCB'
                }

    except Exception as e:
        print(f"Erro ao buscar SELIC do BCB: {e}")

    return None


def fetch_bcb_usd() -> Optional[Dict]:
    """
    Busca a cotação do dólar (PTAX) do Banco Central do Brasil.
    Série temporal 1 = Taxa de câmbio - Livre - Dólar americano (venda)
    """
    try:
        # API do BCB - últimos 5 valores do dólar PTAX
        url = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/5?formato=json"

        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))

            if data and len(data) >= 2:
                latest = data[-1]
                previous = data[-2]

                current_value = float(latest['valor'])
                previous_value = float(previous['valor'])
                change = current_value - previous_value
                change_percent = (change / previous_value) * 100

                return {
                    'value': current_value,
                    'change': change,
                    'changePercent': change_percent,
                    'date': latest['data'],
                    'source': 'BCB'
                }

    except Exception as e:
        print(f"Erro ao buscar USD do BCB: {e}")

    return None


# ========== YAHOO FINANCE ==========

def fetch_yahoo_quote(symbol: str) -> Optional[Dict]:
    """
    Busca cotação do Yahoo Finance.
    Símbolos: ^BVSP (Ibovespa), ^IFIX (IFIX), USDBRL=X (Dólar)
    """
    try:
        # URL da API do Yahoo Finance
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=2d"

        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))

            result = data.get('chart', {}).get('result', [])
            if result and len(result) > 0:
                quote = result[0]
                meta = quote.get('meta', {})

                current_price = meta.get('regularMarketPrice')
                previous_close = meta.get('previousClose') or meta.get('chartPreviousClose')

                if current_price and previous_close:
                    change = current_price - previous_close
                    change_percent = (change / previous_close) * 100

                    return {
                        'symbol': symbol,
                        'price': current_price,
                        'previousClose': previous_close,
                        'change': change,
                        'changePercent': change_percent,
                        'source': 'Yahoo Finance'
                    }

    except Exception as e:
        print(f"Erro ao buscar {symbol} do Yahoo Finance: {e}")

    return None


def fetch_yahoo_multiple(symbols: List[str]) -> Dict[str, Dict]:
    """
    Busca múltiplas cotações do Yahoo Finance.
    """
    results = {}

    for symbol in symbols:
        data = fetch_yahoo_quote(symbol)
        if data:
            results[symbol] = data

    return results


# ========== FUNÇÕES COMBINADAS ==========

def get_market_indices() -> Dict[str, Dict]:
    """
    Retorna dados dos principais índices de mercado.
    Combina dados do BCB e Yahoo Finance.
    """
    indices = {}

    # IBOVESPA do Yahoo Finance
    ibov = fetch_yahoo_quote('^BVSP')
    if ibov:
        indices['IBOV'] = {
            'name': 'IBOV',
            'price': ibov['price'],
            'change': ibov['change'],
            'changePercent': ibov['changePercent'],
            'source': 'Yahoo Finance'
        }
    else:
        indices['IBOV'] = {'name': 'IBOV', 'price': None, 'error': 'Dados indisponíveis'}

    # S&P 500 do Yahoo Finance
    sp500 = fetch_yahoo_quote('^GSPC')
    if sp500:
        indices['S&P 500'] = {
            'name': 'S&P 500',
            'price': sp500['price'],
            'change': sp500['change'],
            'changePercent': sp500['changePercent'],
            'source': 'Yahoo Finance'
        }
    else:
        indices['S&P 500'] = {'name': 'S&P 500', 'price': None, 'error': 'Dados indisponíveis'}

    # USD/BRL do Banco Central (mais confiável)
    usd = fetch_bcb_usd()
    if usd:
        indices['USD/BRL'] = {
            'name': 'USD/BRL',
            'price': usd['value'],
            'change': usd['change'],
            'changePercent': usd['changePercent'],
            'source': 'Banco Central',
            'date': usd['date']
        }
    else:
        # Fallback para Yahoo Finance
        usd_yahoo = fetch_yahoo_quote('USDBRL=X')
        if usd_yahoo:
            indices['USD/BRL'] = {
                'name': 'USD/BRL',
                'price': usd_yahoo['price'],
                'change': usd_yahoo['change'],
                'changePercent': usd_yahoo['changePercent'],
                'source': 'Yahoo Finance'
            }
        else:
            indices['USD/BRL'] = {'name': 'USD/BRL', 'price': None, 'error': 'Dados indisponíveis'}

    # Bitcoin do Yahoo Finance
    btc = fetch_yahoo_quote('BTC-USD')
    if btc:
        indices['BTC'] = {
            'name': 'BTC',
            'price': btc['price'],
            'change': btc['change'],
            'changePercent': btc['changePercent'],
            'source': 'Yahoo Finance'
        }
    else:
        indices['BTC'] = {'name': 'BTC', 'price': None, 'error': 'Dados indisponíveis'}

    # SELIC do Banco Central (fonte oficial)
    selic = fetch_bcb_selic()
    if selic:
        indices['SELIC'] = {
            'name': 'SELIC',
            'price': selic['value'],
            'change': 0,
            'changePercent': 0,
            'source': 'Banco Central',
            'date': selic['date'],
            'note': 'Taxa meta % a.a.'
        }
    else:
        indices['SELIC'] = {'name': 'SELIC', 'price': None, 'error': 'Dados indisponíveis'}

    return indices


def get_stock_quotes(tickers: List[str]) -> Dict[str, Dict]:
    """
    Busca cotações de ações brasileiras do Yahoo Finance.
    Adiciona .SA ao ticker se necessário.
    """
    results = {}

    for ticker in tickers:
        # Adiciona .SA se não tiver
        symbol = ticker if ticker.endswith('.SA') else f"{ticker}.SA"

        data = fetch_yahoo_quote(symbol)
        if data:
            results[ticker] = {
                'ticker': ticker,
                'price': data['price'],
                'change': data['change'],
                'changePercent': data['changePercent'],
                'previousClose': data['previousClose'],
                'source': 'Yahoo Finance'
            }

    return results


def get_market_movers(tickers: List[str]) -> Dict[str, List]:
    """
    Retorna maiores altas, baixas e destaques do IFIX.
    """
    quotes = get_stock_quotes(tickers)

    stocks_list = []
    for ticker, data in quotes.items():
        if data.get('price') and data.get('changePercent') is not None:
            stocks_list.append({
                'ticker': ticker,
                'price': data['price'],
                'change': data['change'],
                'changePercent': data['changePercent']
            })

    # Separa em altas (positivas) e baixas (negativas)
    winners = [s for s in stocks_list if s['changePercent'] > 0]
    losers = [s for s in stocks_list if s['changePercent'] < 0]

    # Ordena winners por maior alta (decrescente) e losers por maior queda (crescente = mais negativo primeiro)
    winners_sorted = sorted(winners, key=lambda x: x['changePercent'], reverse=True)
    losers_sorted = sorted(losers, key=lambda x: x['changePercent'])

    # Busca destaques do IFIX (FIIs)
    ifix_movers = get_ifix_movers()

    return {
        'winners': winners_sorted[:5],
        'losers': losers_sorted[:5],
        'ifix': ifix_movers[:5]
    }


# Principais FIIs do IFIX
IFIX_FUNDS = [
    'MXRF11', 'HGLG11', 'KNRI11', 'XPLG11', 'BTLG11',
    'VISC11', 'HSML11', 'XPML11', 'BCFF11', 'BRCR11',
    'VILG11', 'RBRP11', 'LVBI11', 'PVBI11', 'TRXF11'
]


def get_ifix_movers() -> List[Dict]:
    """
    Retorna os FIIs do IFIX com maior movimentação do dia.
    """
    quotes = get_stock_quotes(IFIX_FUNDS)

    fiis_list = []
    for ticker, data in quotes.items():
        if data.get('price') and data.get('changePercent') is not None:
            fiis_list.append({
                'ticker': ticker,
                'price': data['price'],
                'change': data['change'],
                'changePercent': data['changePercent']
            })

    # Ordena por performance (maior alta primeiro)
    fiis_sorted = sorted(fiis_list, key=lambda x: x['changePercent'], reverse=True)

    return fiis_sorted


def fetch_yahoo_chart(symbol: str, period: str = '1mo', interval: str = '1d') -> Optional[Dict]:
    """
    Busca dados históricos do Yahoo Finance para gráficos.
    Períodos: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max
    Intervalos: 1m, 5m, 15m, 1h, 1d, 1wk, 1mo
    """
    try:
        # Mapeia períodos para range e interval apropriados
        period_map = {
            '1d': ('1d', '5m'),
            '5d': ('5d', '15m'),
            '1mo': ('1mo', '1d'),
            '3mo': ('3mo', '1d'),
            '6mo': ('6mo', '1d'),
            '1y': ('1y', '1d'),
            '2y': ('2y', '1wk'),
            '5y': ('5y', '1wk'),
            'max': ('max', '1mo')
        }

        range_val, interval_val = period_map.get(period, ('1mo', '1d'))

        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval={interval_val}&range={range_val}"

        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        )

        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode('utf-8'))

            result = data.get('chart', {}).get('result', [])
            if result and len(result) > 0:
                chart_data = result[0]
                meta = chart_data.get('meta', {})
                timestamps = chart_data.get('timestamp', [])
                indicators = chart_data.get('indicators', {})
                quote = indicators.get('quote', [{}])[0]

                closes = quote.get('close', [])
                opens = quote.get('open', [])
                highs = quote.get('high', [])
                lows = quote.get('low', [])
                volumes = quote.get('volume', [])

                # Filtra dados nulos
                chart_points = []
                for i, ts in enumerate(timestamps):
                    if closes[i] is not None:
                        chart_points.append({
                            'timestamp': ts,
                            'close': closes[i],
                            'open': opens[i] if i < len(opens) else None,
                            'high': highs[i] if i < len(highs) else None,
                            'low': lows[i] if i < len(lows) else None,
                            'volume': volumes[i] if i < len(volumes) else None
                        })

                return {
                    'symbol': symbol,
                    'currency': meta.get('currency', 'BRL'),
                    'currentPrice': meta.get('regularMarketPrice'),
                    'previousClose': meta.get('previousClose'),
                    'data': chart_points
                }

    except Exception as e:
        print(f"Erro ao buscar chart {symbol}: {e}")

    return None


if __name__ == '__main__':
    print("Testando módulo de dados de mercado...\n")

    # Teste SELIC
    print("=== SELIC (BCB) ===")
    selic = fetch_bcb_selic()
    if selic:
        print(f"Taxa: {selic['value']}% a.a.")
        print(f"Data: {selic['date']}")
    else:
        print("Erro ao buscar SELIC")

    # Teste USD
    print("\n=== USD/BRL (BCB) ===")
    usd = fetch_bcb_usd()
    if usd:
        print(f"Cotação: R$ {usd['value']:.4f}")
        print(f"Variação: {usd['changePercent']:+.2f}%")
    else:
        print("Erro ao buscar USD")

    # Teste IBOV
    print("\n=== IBOVESPA (Yahoo) ===")
    ibov = fetch_yahoo_quote('^BVSP')
    if ibov:
        print(f"Pontos: {ibov['price']:,.0f}")
        print(f"Variação: {ibov['changePercent']:+.2f}%")
    else:
        print("Erro ao buscar IBOV")

    # Teste completo
    print("\n=== Todos os índices ===")
    indices = get_market_indices()
    for name, data in indices.items():
        if data.get('price'):
            print(f"{name}: {data['price']} ({data.get('changePercent', 0):+.2f}%)")
        else:
            print(f"{name}: {data.get('error', 'Erro')}")
