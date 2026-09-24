import logo from '@/assets/images/keelflow_light.svg'
import logoDark from '@/assets/images/keelflow_dark.svg'

import { useSelector } from 'react-redux'

// ==============================|| LOGO ||============================== //

const Logo = () => {
    const customization = useSelector((state) => state.customization)

    return (
        <div style={{ alignItems: 'center', display: 'flex', flexDirection: 'row', marginLeft: '10px' }}>
            <img
                style={{ objectFit: 'contain', height: 'auto', width: 140 }}
                src={customization.isDarkMode ? logoDark : logo}
                alt='Keelflow'
            />
        </div>
    )
}

export default Logo
