import { useState, useEffect } from 'react';

export default function Weather({ widget }) {
  const { location = 'San Francisco, CA' } = widget.config || {};
  
  // In a real app, this would fetch from an API like OpenWeatherMap
  // For the aesthetic showcase, we use mock data that rotates slightly.
  const [temp, setTemp] = useState(72);
  const [desc, setDesc] = useState('Partly Cloudy');
  
  useEffect(() => {
    // Just a fun mock effect
    const id = setInterval(() => {
      setTemp(t => t === 72 ? 73 : 72);
    }, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-weather">
      <div className="w-weather-top">
        <div className="w-weather-temp">{temp}°</div>
        <div className="w-weather-icon">
          {desc.includes('Cloud') ? '⛅️' : '☀️'}
        </div>
      </div>
      <div className="w-weather-bottom">
        <div className="w-weather-city">{location}</div>
        <div className="w-weather-desc">{desc}</div>
      </div>
    </div>
  );
}
