import { AppBar, Box, Stack, Typography } from '@mui/material'
import type { Plan } from '../types'

interface AppHeaderProps {
  plan: Plan | null
}

export default function AppHeader({ plan }: AppHeaderProps) {
  return (
    <AppBar
      component="header"
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'border.main',
        color: 'text.primary',
        zIndex: 2000,
      }}
    >
      <Box
        sx={{
          maxWidth: 1580,
          mx: 'auto',
          width: '100%',
          px: 3,
          py: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 3,
        }}
      >
        <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box
            aria-hidden
            sx={{
              width: 30,
              height: 30,
              borderRadius: 1,
              bgcolor: 'primary.main',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)',
            }}
          >
            <Box
              component="svg"
              viewBox="0 0 24 24"
              role="img"
              sx={{
                width: 18,
                height: 18,
                fill: 'none',
                stroke: '#fff',
                strokeWidth: 1.8,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              }}
            >
              <path d="M5 17.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm14 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
              <path d="M6.5 19h11M4 7.5h7.5a3 3 0 0 1 2.12.88l2.5 2.5A3 3 0 0 0 18.24 12H20" />
              <path d="M4 7.5V5a1 1 0 0 1 1-1h7.5a6 6 0 0 1 4.24 1.76l2.5 2.5A6 6 0 0 0 23 10v4a1 1 0 0 1-1 1h-2.2" />
            </Box>
          </Box>

          <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary', lineHeight: 1.1}}>
            ELD Trip Planner
          </Typography>
        </Stack>


        {plan && (
          <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: '18px' }}>
            <MetaItem label="Distance" value={`${plan.summary.total_distance_miles} mi`} />
            <MetaItem label="Drive"    value={`${plan.summary.total_driving_hours.toFixed(1)} h`} />
            <MetaItem label="Days"     value={String(plan.summary.num_days)} />
          </Stack>
        )}
      </Box>
    </AppBar>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <Stack sx={{ alignItems: 'flex-end', lineHeight: 1.2 }}>
      <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>{value}</Typography>
    </Stack>
  )
}
