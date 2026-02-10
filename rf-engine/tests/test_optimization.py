
import pytest
from unittest.mock import MagicMock
import sys
import os

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from optimization_service import OptimizationService

@pytest.fixture
def mock_tile_manager():
    tm = MagicMock()
    tm.get_elevation.return_value = 100.0
    tm.get_elevations_batch.return_value = [100.0] * 121
    tm.get_elevation_profile.return_value = [100.0] * 20
    return tm

class TestOptimizationService:
    def test_calculate_prominence_peak(self, mock_tile_manager):
        service = OptimizationService(mock_tile_manager)
        
        # Scenario: Peak at 100m, neighbors at 50m
        mock_tile_manager.get_elevation.return_value = 100.0
        mock_tile_manager.get_elevations_batch.return_value = [50.0] * 121
        
        prom = service.calculate_prominence(0, 0)
        assert prom == 50.0

    def test_calculate_prominence_flat(self, mock_tile_manager):
        service = OptimizationService(mock_tile_manager)
        
        # Scenario: Flat terrain
        mock_tile_manager.get_elevation.return_value = 100.0
        mock_tile_manager.get_elevations_batch.return_value = [100.0] * 121
        
        prom = service.calculate_prominence(0, 0)
        assert prom == 0.0

    def test_calculate_prominence_valley(self, mock_tile_manager):
        service = OptimizationService(mock_tile_manager)
        
        # Scenario: Valley (Center 50m, Neighbors 100m)
        mock_tile_manager.get_elevation.return_value = 50.0
        mock_tile_manager.get_elevations_batch.return_value = [100.0] * 121
        
        prom = service.calculate_prominence(0, 0)
        # Should be 0 (max(0, -50))
        assert prom == 0.0

    def test_score_candidate_defaults(self, mock_tile_manager):
        service = OptimizationService(mock_tile_manager)
        
        cand = {"lat": 0, "lon": 0, "elevation": 100}
        weights = {"elevation": 1, "prominence": 1, "fresnel": 1}
        
        mock_tile_manager.get_elevations_batch.return_value = [50.0] * 121 # Prominence = 50
        
        metrics = service.score_candidate(cand, weights, rx_list=None)
        
        assert metrics['prominence'] == 50.0
        assert metrics['fresnel'] == 1.0

    def test_score_candidate_with_rx(self, mock_tile_manager):
        service = OptimizationService(mock_tile_manager)
        
        cand = {"lat": 0, "lon": 0, "elevation": 100}
        weights = {"elevation": 1, "prominence": 1, "fresnel": 1}
        rx_list = [{"lat": 0.1, "lon": 0.1, "height": 10}]
        
        # Mock Fresnel check to return 0.5
        service.check_fresnel_clearance = MagicMock(return_value=0.5)
        
        metrics = service.score_candidate(
            cand, weights, rx_list, 
            tx_height=20.0, rx_height=5.0, freq_mhz=433.0
        )
        
        service.check_fresnel_clearance.assert_called_with(
            0, 0, 20.0, rx_list, 433.0
        )
        assert metrics['fresnel'] == 0.5
