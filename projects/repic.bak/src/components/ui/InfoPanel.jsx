import { memo, useState, useCallback } from 'react';
import { Info, BarChart3, Database, Calendar, Globe, Album, Copy } from '../icons';
import useI18n from '../../hooks/useI18n';

// Panel width constant for consistency
const PANEL_WIDTH = 280;

// Transition duration in ms
const TRANSITION_DURATION = 250;

// Link icon
const Link = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
);

// Folder icon
const Folder = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
);

// Copy button component
const CopyButton = memo(function CopyButton({ text, className = '' }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, [text]);

    return (
        <button
            onClick={handleCopy}
            className={`p-1 rounded hover:bg-white/10 transition-colors ${className}`}
            title={copied ? '已複製' : '複製'}
        >
            {copied ? (
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            ) : (
                <Copy size={14} className="text-white/50 hover:text-white/80" />
            )}
        </button>
    );
});

export const InfoPanel = memo(function InfoPanel({ metadata, isVisible = true, mode = 'local' }) {
    const { t, language } = useI18n();

    const formatDate = (date) => {
        if (!date) return t('unknown');
        return new Date(date).toLocaleString(language === 'zh-TW' ? 'zh-TW' : 'en-US');
    };

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Extract domain from URL
    const getDomain = (url) => {
        if (!url) return t('unknown');
        try {
            return new URL(url).hostname;
        } catch {
            return url.substring(0, 30) + '...';
        }
    };

    // CSS transition for smooth open/close - width based, not transform
    const panelStyle = {
        width: isVisible ? PANEL_WIDTH : 0,
        transition: `width ${TRANSITION_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        overflow: 'hidden',
    };

    return (
        <aside
            style={panelStyle}
            className="h-full min-h-0 bg-surface/90 backdrop-blur-xl border-l border-black/10 dark:border-white/5 shrink-0"
        >
            {/* Fixed width inner container prevents content squish */}
            <div className="flex flex-col h-full min-h-0 p-6" style={{ width: PANEL_WIDTH, minWidth: PANEL_WIDTH }}>
                {metadata ? (
                    <>
                        <div className="flex items-center gap-2 mb-8 border-b border-white/5 pb-4">
                            <Info size={18} className="text-primary" />
                            <h2 className="text-sm font-semibold text-white tracking-wider uppercase">{t('details')}</h2>
                        </div>

                        <div className="space-y-8 overflow-y-auto no-scrollbar pr-2 flex-1">
                            {mode === 'web' ? (
                                <>
                                    {/* Web image info */}
                                    <InfoItem
                                        icon={<Album size={16} />}
                                        label={t('albumNameLabel')}
                                        value={metadata.albumName || t('unknown')}
                                    />

                                    <InfoItem
                                        icon={<Globe size={16} />}
                                        label={t('imageSource')}
                                        value={getDomain(metadata.url)}
                                    />

                                    <InfoItem
                                        icon={<Link size={16} />}
                                        label={t('imageUrl')}
                                        value={
                                            <div className="flex items-start gap-1">
                                                <a
                                                    href={metadata.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline break-all text-xs flex-1"
                                                    title={metadata.url}
                                                >
                                                    {metadata.url?.length > 40
                                                        ? metadata.url.substring(0, 40) + '...'
                                                        : metadata.url}
                                                </a>
                                                <CopyButton text={metadata.url} />
                                            </div>
                                        }
                                    />

                                    <InfoItem
                                        icon={<Calendar size={16} />}
                                        label={t('addedDate')}
                                        value={formatDate(metadata.addedAt)}
                                    />

                                    <InfoItem
                                        icon={<BarChart3 size={16} />}
                                        label={t('imageIndex')}
                                        value={`${metadata.index + 1} / ${metadata.total}`}
                                    />
                                </>
                            ) : (
                                <>
                                    {/* Local file info */}
                                    <InfoItem
                                        icon={<Folder size={16} />}
                                        label={t('filePath')}
                                        value={
                                            <div className="flex items-start gap-1">
                                                <span className="break-all text-xs flex-1" title={metadata.filePath}>
                                                    {metadata.filePath?.length > 40
                                                        ? '...' + metadata.filePath.slice(-40)
                                                        : metadata.filePath}
                                                </span>
                                                <CopyButton text={metadata.filePath} />
                                            </div>
                                        }
                                    />

                                    <InfoItem
                                        icon={<BarChart3 size={16} />}
                                        label={t('imageResolution')}
                                        value={`${metadata.width} x ${metadata.height}`}
                                    />

                                    <InfoItem
                                        icon={<Database size={16} />}
                                        label={t('fileSize')}
                                        value={formatSize(metadata.size)}
                                    />

                                    <InfoItem
                                        icon={<Calendar size={16} />}
                                        label={t('createdDate')}
                                        value={formatDate(metadata.birthtime)}
                                    />

                                    <InfoItem
                                        icon={<Calendar size={16} />}
                                        label={t('modifiedDate')}
                                        value={formatDate(metadata.mtime)}
                                    />
                                </>
                            )}
                        </div>

                        <div className="pt-4 border-t border-white/5 text-[10px] text-white/20 text-center uppercase tracking-[0.2em]">
                            Repic Pro Engine
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <Info size={32} className="text-white/20 mb-3" />
                        <p className="text-white/40 text-sm font-medium">{t('details')}</p>
                        <p className="text-white/20 text-xs mt-1">{t('noImageSelected') || 'Select an image to view details'}</p>
                    </div>
                )}
            </div>
        </aside>
    );
});

const InfoItem = memo(function InfoItem({ icon, label, value }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-primary font-medium text-[11px] uppercase tracking-wider">
                {icon}
                <span>{label}</span>
            </div>
            <div className="text-white text-sm font-light mt-1 pl-6 border-l border-primary/20">
                {value}
            </div>
        </div>
    );
});
