import { Link } from 'react-router-dom';
import './Home.css';

export default function Home() {
    return (
        <div className="home-container">
            <h1 className="home-title">Araçlar</h1>
            <div className="cards">
                <Link to="/ns" className="card">
                    <div className="card-icon">🌐</div>
                    <h2>NS Lookup</h2>
                    <p>DNS kayıtlarını ve WHOIS bilgilerini sorgula</p>
                </Link>
                <Link to="/kelime" className="card">
                    <div className="card-icon">📝</div>
                    <h2>Kelime</h2>
                    <p>Metin düzenleme ve dönüştürme aracı</p>
                </Link>
            </div>
        </div>
    );
}
