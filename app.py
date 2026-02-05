#!/usr/bin/env python3

from flask import Flask, jsonify, render_template
from fundamentus import get_data
from datetime import datetime

app = Flask(__name__)

# Cache global
_cache = {
    'data': None,
    'last_update': None
}

def get_cached_data():
    """Retorna dados em cache, atualizando apenas uma vez por dia."""
    today = datetime.strftime(datetime.today(), '%Y-%m-%d')

    if _cache['data'] is None or _cache['last_update'] != today:
        raw_data = dict(get_data())
        # Converte Decimal para float para serialização JSON
        _cache['data'] = {
            ticker: {k: float(v) for k, v in indicators.items()}
            for ticker, indicators in raw_data.items()
        }
        _cache['last_update'] = today

    return _cache['data']


@app.route("/")
def index():
    """Página principal da aplicação."""
    return render_template('index.html')


@app.route("/api/stocks")
def api_stocks():
    """API que retorna todos os dados das ações."""
    data = get_cached_data()
    return jsonify(data)


@app.route("/api/stocks/<ticker>")
def api_stock_detail(ticker):
    """API que retorna dados de uma ação específica."""
    data = get_cached_data()
    ticker = ticker.upper()

    if ticker in data:
        return jsonify({ticker: data[ticker]})
    else:
        return jsonify({'error': 'Ação não encontrada'}), 404


@app.route("/api/tickers")
def api_tickers():
    """API que retorna lista de todos os tickers disponíveis."""
    data = get_cached_data()
    tickers = sorted(data.keys())
    return jsonify(tickers)


if __name__ == '__main__':
    print("Iniciando servidor...")
    print("Acesse local: http://127.0.0.1:5000")
    print("Acesse na rede: http://<SEU_IP>:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
