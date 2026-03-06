import { FolderOpen } from '../../components/icons';
import { Button } from '../../components/ui/Button';
import useI18n from '../../hooks/useI18n';

export const Dropzone = ({ onOpenFolder }) => {
    const { t } = useI18n();

    return (
        <div className="flex items-center justify-center h-full">
            <Button
                variant="ghost"
                icon={FolderOpen}
                className="text-white/40 hover:text-white/60 hover:bg-white/5"
                onClick={onOpenFolder}
            >
                {t('openFolder')}
            </Button>
        </div>
    );
};
