#!/usr/bin/env python3

from flask import Flask, jsonify, render_template
from fundamentus import get_data
from brapi import fetch_quote, fetch_multiple_quotes, format_brapi_data
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
    """Combina dados do Fundamentus com dados da brapi.dev."""
    combined = {
        'ticker': ticker,
        'source': 'fundamentus',

        # Dados do Fundamentus
        **fundamentus_data
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


@app.route("/api/ibovespa")
def api_ibovespa():
    """Retorna cotações das principais ações do Ibovespa."""
    results = []
    brapi_data = fetch_multiple_quotes(IBOVESPA_STOCKS)

    for ticker in IBOVESPA_STOCKS:
        if ticker in brapi_data:
            data = brapi_data[ticker]
            results.append({
                'ticker': ticker,
                'shortName': data.get('shortName', ''),
                'price': data.get('regularMarketPrice'),
                'change': data.get('regularMarketChange'),
                'changePercent': data.get('regularMarketChangePercent'),
                'volume': data.get('regularMarketVolume'),
                'marketCap': data.get('marketCap')
            })

    return jsonify(results)


@app.route("/api/market-movers")
def api_market_movers():
    """Retorna maiores altas, baixas e volume do dia."""
    brapi_data = fetch_multiple_quotes(IBOVESPA_STOCKS)

    stocks_list = []
    for ticker, data in brapi_data.items():
        if data.get('regularMarketChangePercent') is not None:
            stocks_list.append({
                'ticker': ticker,
                'shortName': data.get('shortName', ''),
                'price': data.get('regularMarketPrice'),
                'change': data.get('regularMarketChange'),
                'changePercent': data.get('regularMarketChangePercent'),
                'volume': data.get('regularMarketVolume', 0)
            })

    # Ordenar por variação percentual
    sorted_by_change = sorted(stocks_list, key=lambda x: x['changePercent'] or 0, reverse=True)
    sorted_by_volume = sorted(stocks_list, key=lambda x: x['volume'] or 0, reverse=True)

    return jsonify({
        'winners': sorted_by_change[:5],
        'losers': sorted_by_change[-5:][::-1],
        'volume': sorted_by_volume[:5]
    })


if __name__ == '__main__':
    print("Iniciando servidor...")
    print("Acesse local: http://127.0.0.1:5000")
    print("Acesse na rede: http://<SEU_IP>:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
