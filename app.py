#!/usr/bin/env python3

from flask import Flask, jsonify, render_template, request
from fundamentus import get_data
from brapi import fetch_quote, fetch_multiple_quotes, format_brapi_data
from market_data import get_market_indices, get_stock_quotes, get_market_movers, fetch_yahoo_chart
from news import fetch_all_news, fetch_feed, get_available_sources
from datetime import datetime
import threading

app = Flask(__name__)

# Cache global
_cache = {
    'fundamentus_data': None,
    'brapi_data': {},
    'last_update': None
}

# Lock para thread safety
_cache_lock = threading.Lock()


def get_fundamentus_data():
    """Retorna dados do Fundamentus em cache, atualizando apenas uma vez por dia."""
    today = datetime.strftime(datetime.today(), '%Y-%m-%d')

    with _cache_lock:
        if _cache['fundamentus_data'] is None or _cache['last_update'] != today:
            raw_data = dict(get_data())
            _cache['fundamentus_data'] = {
                ticker: {k: float(v) for k, v in indicators.items()}
                for ticker, indicators in raw_data.items()
            }
            _cache['last_update'] = today

        return _cache['fundamentus_data']


def get_brapi_data(ticker: str):
    """Busca dados complementares da brapi.dev para um ticker específico."""
    with _cache_lock:
        # Verifica se já está em cache (cache de 1 hora)
        if ticker in _cache['brapi_data']:
            cached = _cache['brapi_data'][ticker]
            if cached.get('cached_at'):
                cache_age = (datetime.now() - cached['cached_at']).seconds
                if cache_age < 3600:  # 1 hora
                    return cached.get('data')

    # Busca dados frescos
    raw_data = fetch_quote(ticker)
    if raw_data:
        formatted = format_brapi_data(raw_data)
        with _cache_lock:
            _cache['brapi_data'][ticker] = {
                'data': formatted,
                'cached_at': datetime.now()
            }
        return formatted

    return None


def combine_stock_data(ticker: str, fundamentus_data: dict, brapi_data: dict = None):
    """Combina dados do Fundamentus com dados da brapi.dev e calcula indicadores derivados."""

    # Preço atual (prioriza brapi se disponível)
    cotacao = fundamentus_data.get('Cotacao', 0)
    if brapi_data and brapi_data.get('regularMarketPrice'):
        cotacao = brapi_data.get('regularMarketPrice')

    # Calcula LPA (Lucro por Ação) = Cotação / P/L
    pl = fundamentus_data.get('P/L', 0)
    lpa = cotacao / pl if pl and pl != 0 else 0

    # Calcula VPA (Valor Patrimonial por Ação) = Cotação / P/VP
    pvp = fundamentus_data.get('P/VP', 0)
    vpa = cotacao / pvp if pvp and pvp != 0 else 0

    # Calcula DPA (Dividendo por Ação) = Cotação * DY
    dy = fundamentus_data.get('DY', 0)
    dpa = cotacao * dy if dy else 0

    combined = {
        'ticker': ticker,
        'source': 'fundamentus',

        # Dados do Fundamentus
        **fundamentus_data,

        # Indicadores calculados para Valuation
        'LPA': round(lpa, 2),
        'VPA': round(vpa, 2),
        'DPA': round(dpa, 2),
    }

    if brapi_data:
        combined['source'] = 'combined'
        combined['brapi'] = {
            'longName': brapi_data.get('longName', ''),
            'shortName': brapi_data.get('shortName', ''),
            'sector': brapi_data.get('sector', ''),
            'industry': brapi_data.get('industry', ''),
            'marketCap': brapi_data.get('marketCap'),
            'regularMarketPrice': brapi_data.get('regularMarketPrice'),
            'regularMarketChange': brapi_data.get('regularMarketChange'),
            'regularMarketChangePercent': brapi_data.get('regularMarketChangePercent'),
            'regularMarketVolume': brapi_data.get('regularMarketVolume'),
            'regularMarketDayHigh': brapi_data.get('regularMarketDayHigh'),
            'regularMarketDayLow': brapi_data.get('regularMarketDayLow'),
            'fiftyTwoWeekHigh': brapi_data.get('fiftyTwoWeekHigh'),
            'fiftyTwoWeekLow': brapi_data.get('fiftyTwoWeekLow'),
            'fiftyDayAverage': brapi_data.get('fiftyDayAverage'),
            'twoHundredDayAverage': brapi_data.get('twoHundredDayAverage'),
        }

    return combined


@app.route("/")
def index():
    """Página inicial - Hub de Notícias."""
    return render_template('home.html', active_page='home')


@app.route("/fundamentos")
def fundamentos():
    """Página de análise fundamentalista."""
    return render_template('fundamentos.html', active_page='fundamentos')


@app.route("/valuation")
def valuation():
    """Página de valuation."""
    return render_template('valuation.html', active_page='valuation')


@app.route("/api/stocks")
def api_stocks():
    """API que retorna todos os dados das ações (Fundamentus)."""
    data = get_fundamentus_data()
    return jsonify(data)


@app.route("/api/stocks/<ticker>")
def api_stock_detail(ticker):
    """API que retorna dados combinados de uma ação específica."""
    fundamentus_data = get_fundamentus_data()
    ticker = ticker.upper()

    if ticker not in fundamentus_data:
        return jsonify({'error': 'Ação não encontrada'}), 404

    # Busca dados complementares da brapi
    brapi_data = get_brapi_data(ticker)

    # Combina os dados
    combined = combine_stock_data(ticker, fundamentus_data[ticker], brapi_data)

    return jsonify(combined)


@app.route("/api/stocks/<ticker>/brapi")
def api_stock_brapi(ticker):
    """API que retorna apenas dados da brapi.dev."""
    ticker = ticker.upper()
    brapi_data = get_brapi_data(ticker)

    if brapi_data:
        return jsonify(brapi_data)
    else:
        return jsonify({'error': 'Dados não disponíveis na brapi'}), 404


@app.route("/api/tickers")
def api_tickers():
    """API que retorna lista de todos os tickers disponíveis."""
    data = get_fundamentus_data()
    tickers = sorted(data.keys())
    return jsonify(tickers)


@app.route("/api/compare")
def api_compare():
    """API para comparar múltiplas ações com dados combinados."""
    from flask import request

    tickers_param = request.args.get('tickers', '')
    if not tickers_param:
        return jsonify({'error': 'Parâmetro tickers é obrigatório'}), 400

    tickers = [t.strip().upper() for t in tickers_param.split(',')]
    fundamentus_data = get_fundamentus_data()

    results = {}
    for ticker in tickers:
        if ticker in fundamentus_data:
            brapi_data = get_brapi_data(ticker)
            results[ticker] = combine_stock_data(ticker, fundamentus_data[ticker], brapi_data)

    return jsonify(results)


# Principais ações do Ibovespa
IBOVESPA_STOCKS = [
    'PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'B3SA3', 'ABEV3', 'WEGE3', 'RENT3',
    'BBAS3', 'ITSA4', 'RADL3', 'SUZB3', 'JBSS3', 'GGBR4', 'LREN3', 'RAIL3',
    'EQTL3', 'VIVT3', 'BPAC11', 'PRIO3', 'CSNA3', 'CSAN3', 'MGLU3', 'HAPV3'
]


@app.route("/api/indices")
def api_indices():
    """Retorna dados dos principais índices (IBOV, IFIX, USD/BRL, SELIC)."""
    indices = get_market_indices()
    return jsonify(indices)


@app.route("/api/ibovespa")
def api_ibovespa():
    """Retorna cotações das principais ações do Ibovespa."""
    # Usa Yahoo Finance para dados mais confiáveis
    yahoo_data = get_stock_quotes(IBOVESPA_STOCKS)

    results = []
    for ticker in IBOVESPA_STOCKS:
        if ticker in yahoo_data:
            data = yahoo_data[ticker]
            results.append({
                'ticker': ticker,
                'shortName': '',  # Yahoo não retorna nome curto
                'price': data.get('price'),
                'change': data.get('change'),
                'changePercent': data.get('changePercent'),
                'volume': None,
                'marketCap': None
            })

    return jsonify(results)


@app.route("/api/market-movers")
def api_market_movers():
    """Retorna maiores altas, baixas e volume do dia."""
    # Usa Yahoo Finance para dados mais confiáveis
    movers = get_market_movers(IBOVESPA_STOCKS)
    return jsonify(movers)


# ========== GRÁFICOS ==========

# Mapeamento de símbolos para gráficos
CHART_SYMBOLS = {
    'IBOV': '^BVSP',
    'S&P 500': '^GSPC',
    'BTC': 'BTC-USD',
    'USD/BRL': 'USDBRL=X'
}


@app.route("/api/chart/<symbol>")
def api_chart(symbol):
    """Retorna dados históricos para gráficos."""
    period = request.args.get('period', '1mo')

    # Verifica se é um índice conhecido
    chart_symbol = CHART_SYMBOLS.get(symbol.upper(), symbol)

    # Adiciona .SA para ações brasileiras se necessário
    if chart_symbol == symbol and not symbol.startswith('^') and '=' not in symbol and '-' not in symbol:
        if not symbol.upper().endswith('.SA'):
            chart_symbol = f"{symbol.upper()}.SA"

    chart_data = fetch_yahoo_chart(chart_symbol, period)

    if chart_data:
        chart_data['displayName'] = symbol.upper()
        return jsonify(chart_data)
    else:
        return jsonify({'error': 'Dados não disponíveis'}), 404


# ========== NOTÍCIAS ==========

@app.route("/api/news")
def api_news():
    """Retorna notícias de todas as fontes."""
    limit = request.args.get('limit', 5, type=int)
    news = fetch_all_news(limit_per_source=limit)
    return jsonify(news)


@app.route("/api/news/<source>")
def api_news_source(source):
    """Retorna notícias de uma fonte específica."""
    limit = request.args.get('limit', 10, type=int)
    news = fetch_feed(source, limit=limit)
    return jsonify(news)


@app.route("/api/news/sources")
def api_news_sources():
    """Retorna lista de fontes de notícias disponíveis."""
    return jsonify(get_available_sources())


if __name__ == '__main__':
    print("Iniciando servidor...")
    print("Acesse local: http://127.0.0.1:5000")
    print("Acesse na rede: http://<SEU_IP>:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
