from flask import Flask, jsonify, request
from flask_cors import CORS
import sys
import os

# Ensure backend_ai_agent can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from backend_ai_agent import BankingNewsOrchestrator

app = Flask(__name__)
CORS(app)  # Enable CORS to allow requests from your Vercel frontend

# Initialize the agent
agent = BankingNewsOrchestrator()

@app.route('/')
def health_check():
    return jsonify({"status": "active", "service": "Arthashastra AI Backend"})

@app.route('/api/news', methods=['GET'])
def get_news():
    query = request.args.get('q', 'Indian Banking Sector')
    data = agent.fetch_live_news(query)
    return jsonify(data)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)