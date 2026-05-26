// NOTBOT YouTube Downloader Engine
// ZYN COMPANY - Prof. Meowh Raja 👑

const API_ENDPOINT = 'https://api.notbot.workers.dev/api/youtube';
const FALLBACK_API = 'https://p.oceansaver.in/ajax/download.php';

let currentVideoData = null;

document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const fetchBtn = document.getElementById('fetchBtn');
    const loading = document.getElementById('loading');
    const result = document.getElementById('result');

    fetchBtn.addEventListener('click', () => fetchVideo(urlInput.value));
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchVideo(urlInput.value);
    });
});

async function fetchVideo(url) {
    if (!url.trim()) {
        showError('Masukkan link YouTube dulu tuan');
        return;
    }

    // Extract video ID
    const videoId = extractVideoId(url);
    if (!videoId) {
        showError('Link YouTube tidak valid');
        return;
    }

    showLoading(true);
    hideResult();

    try {
        // Multiple API attempts
        let data = await fetchFromAPI(videoId);
        
        if (!data || !data.formats) {
            data = await fetchFromFallbackAPI(url);
        }

        if (data && data.formats && data.formats.length > 0) {
            currentVideoData = data;
            displayResult(data);
        } else {
            showError('Gagal fetch data video');
        }
    } catch (error) {
        console.error(error);
        showError('Error: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/,
        /youtube\.com\/embed\/([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

async function fetchFromAPI(videoId) {
    // Menggunakan multiple public API endpoints yang bocor
    const endpoints = [
        `https://youtube-mp3-downloader2.p.rapidapi.com/ytVideo/info?id=${videoId}`,
        `https://yt-api.p.rapidapi.com/dl?id=${videoId}`,
        `https://api.ytdl.pw/api/download/${videoId}`
    ];
    
    for (const endpoint of endpoints) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const response = await fetch(endpoint, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                if (data && (data.formats || data.url)) {
                    return formatData(data, videoId);
                }
            }
        } catch (e) {
            continue;
        }
    }
    
    // Fallback: scraping langsung menggunakan CORS proxy
    return await scrapeDirect(videoId);
}

async function scrapeDirect(videoId) {
    const proxy = 'https://cors-anywhere.herokuapp.com/';
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    try {
        const response = await fetch(proxy + url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const html = await response.text();
        
        // Extract ytInitialPlayerResponse dari HTML
        const initialDataMatch = html.match(/var ytInitialPlayerResponse = ({.+?});/);
        if (initialDataMatch) {
            const playerResponse = JSON.parse(initialDataMatch[1]);
            const formats = playerResponse.streamingData?.formats || [];
            const adaptiveFormats = playerResponse.streamingData?.adaptiveFormats || [];
            const allFormats = [...formats, ...adaptiveFormats];
            
            const videoDetails = playerResponse.videoDetails;
            
            return {
                title: videoDetails?.title || 'Unknown',
                author: videoDetails?.author || 'Unknown',
                duration: videoDetails?.lengthSeconds || 0,
                thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                videoId: videoId,
                formats: allFormats.map(f => ({
                    quality: f.qualityLabel || f.quality || 'Unknown',
                    mimeType: f.mimeType || 'video/mp4',
                    url: f.url,
                    contentLength: f.contentLength || 0,
                    hasVideo: f.hasVideo !== false,
                    hasAudio: f.hasAudio !== false
                }))
            };
        }
        
        throw new Error('No formats found');
    } catch (error) {
        throw new Error('Scraping failed');
    }
}

async function fetchFromFallbackAPI(url) {
    // Menggunakan API lain sebagai fallback
    const formData = new FormData();
    formData.append('url', url);
    
    const response = await fetch(FALLBACK_API, {
        method: 'POST',
        body: formData
    });
    
    const data = await response.json();
    return {
        title: data.title || 'Unknown',
        thumbnail: data.thumbnail || '',
        formats: data.medias || []
    };
}

function formatData(raw, videoId) {
    // Normalize data format
    return {
        title: raw.title || raw.videoDetails?.title || 'Unknown Title',
        author: raw.author || raw.videoDetails?.author || 'Unknown',
        duration: raw.duration || raw.videoDetails?.lengthSeconds || 0,
        thumbnail: raw.thumbnail || raw.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        videoId: videoId,
        formats: (raw.formats || []).map(f => ({
            quality: f.quality || f.qualityLabel || f.height + 'p' || 'Unknown',
            mimeType: f.mimeType || 'video/mp4',
            url: f.url || f.downloadUrl,
            contentLength: f.contentLength || f.size || 0,
            hasVideo: !f.hasVideo === false,
            hasAudio: f.hasAudio !== false
        }))
    };
}

function displayResult(data) {
    const resultDiv = document.getElementById('result');
    
    // Filter formats
    const videoFormats = data.formats.filter(f => f.hasVideo !== false && f.url);
    const audioFormats = data.formats.filter(f => f.hasAudio !== false && (!f.hasVideo || f.hasVideo === false));
    
    // Sort by quality
    videoFormats.sort((a, b) => {
        const qualityA = parseInt(a.quality) || 0;
        const qualityB = parseInt(b.quality) || 0;
        return qualityB - qualityA;
    });
    
    const formatSize = (bytes) => {
        if (!bytes) return 'Unknown';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
    };
    
    resultDiv.innerHTML = `
        <div class="video-info">
            <div class="thumbnail">
                <img src="${data.thumbnail}" alt="Thumbnail" onerror="this.src='https://img.youtube.com/vi/${data.videoId}/hqdefault.jpg'">
            </div>
            <div class="details">
                <h3>${escapeHtml(data.title)}</h3>
                <p><i class="fas fa-user"></i> ${escapeHtml(data.author)}</p>
                <p><i class="fas fa-clock"></i> ${formatDuration(data.duration)}</p>
                <p><i class="fab fa-youtube"></i> ${data.videoId}</p>
            </div>
        </div>
        <div class="quality-section">
            <div class="quality-title">
                <i class="fas fa-video"></i> VIDEO QUALITY
            </div>
            <div class="quality-grid" id="videoQualities"></div>
            
            <div class="quality-title" style="margin-top: 20px;">
                <i class="fas fa-music"></i> AUDIO QUALITY
            </div>
            <div class="quality-grid" id="audioQualities"></div>
            
            <div class="download-all">
                <button class="btn-download" onclick="downloadBestQuality()">
                    <i class="fas fa-download"></i> Best Video
                </button>
                <button class="btn-download mp3" onclick="downloadBestAudio()">
                    <i class="fas fa-headphones"></i> Best MP3
                </button>
            </div>
        </div>
    `;
    
    // Populate video qualities
    const videoGrid = document.getElementById('videoQualities');
    videoFormats.forEach(format => {
        const btn = document.createElement('div');
        btn.className = 'quality-btn';
        btn.onclick = () => downloadUrl(format.url, `${data.title}_${format.quality}.mp4`);
        btn.innerHTML = `
            <span class="quality-label">${format.quality || 'Unknown'}</span>
            <span class="quality-size">${formatSize(format.contentLength)}</span>
        `;
        videoGrid.appendChild(btn);
    });
    
    // Populate audio qualities
    const audioGrid = document.getElementById('audioQualities');
    const audioQualities = [
        { label: 'MP3 320kbps', bitrate: 320 },
        { label: 'MP3 256kbps', bitrate: 256 },
        { label: 'MP3 192kbps', bitrate: 192 },
        { label: 'MP3 128kbps', bitrate: 128 }
    ];
    
    audioQualities.forEach(audio => {
        const btn = document.createElement('div');
        btn.className = 'quality-btn';
        btn.onclick = () => extractAndDownloadAudio(data.videoId, audio.bitrate, data.title);
        btn.innerHTML = `
            <span class="quality-label">${audio.label}</span>
            <span class="quality-size">~${Math.round(3.5 * audio.bitrate / 128)} MB</span>
        `;
        audioGrid.appendChild(btn);
    });
    
    resultDiv.classList.remove('hidden');
}

function downloadUrl(url, filename) {
    if (!url) {
        showError('URL download tidak tersedia');
        return;
    }
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

async function extractAndDownloadAudio(videoId, bitrate, title) {
    showLoading(true);
    
    try {
        // Convert ke audio menggunakan external API
        const apiUrl = `https://youtube-mp3.p.rapidapi.com/convert?id=${videoId}&bitrate=${bitrate}`;
        
        // Alternative: menggunakan endpoint convert
        const response = await fetch(`https://api.notbot.workers.dev/convert/${videoId}?bitrate=${bitrate}`);
        const data = await response.json();
        
        if (data.url) {
            downloadUrl(data.url, `${title}_${bitrate}kbps.mp3`);
        } else {
            showError('Gagal konversi audio');
        }
    } catch (error) {
        showError('Gagal extract audio');
    } finally {
        showLoading(false);
    }
}

function downloadBestQuality() {
    if (!currentVideoData) return;
    const bestVideo = currentVideoData.formats
        .filter(f => f.hasVideo !== false && f.url)
        .sort((a, b) => {
            const qualA = parseInt(a.quality) || 0;
            const qualB = parseInt(b.quality) || 0;
            return qualB - qualA;
        })[0];
    
    if (bestVideo) {
        downloadUrl(bestVideo.url, `${currentVideoData.title}_${bestVideo.quality}.mp4`);
    }
}

function downloadBestAudio() {
    if (!currentVideoData) return;
    extractAndDownloadAudio(currentVideoData.videoId, 320, currentVideoData.title);
}

function formatDuration(seconds) {
    if (!seconds) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    const fetchBtn = document.getElementById('fetchBtn');
    if (show) {
        loading.classList.remove('hidden');
        fetchBtn.disabled = true;
    } else {
        loading.classList.add('hidden');
        fetchBtn.disabled = false;
    }
}

function hideResult() {
    const result = document.getElementById('result');
    result.classList.add('hidden');
    currentVideoData = null;
}

function showError(message) {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = `
        <div style="background: rgba(255,0,102,0.1); border: 1px solid #ff0066; border-radius: 16px; padding: 20px; text-align: center;">
            <i class="fas fa-skull" style="font-size: 40px; color: #ff0066; margin-bottom: 10px; display: block;"></i>
            <p style="color: #ff0066;">${escapeHtml(message)}</p>
        </div>
    `;
    resultDiv.classList.remove('hidden');
    
    setTimeout(() => {
        if (resultDiv.innerHTML.includes(message)) {
            resultDiv.classList.add('hidden');
        }
    }, 3000);
}

// Service Worker untuk background download (opsional)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
}