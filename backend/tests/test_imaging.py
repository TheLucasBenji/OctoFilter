from __future__ import annotations

import math

import numpy as np
import pytest

from imaging import metrics, noise


def test_mse_and_snr_for_identical_images() -> None:
    image = np.array([[0, 10], [20, 30]], dtype=np.uint8)

    assert metrics.mse(image, image) == 0.0
    assert math.isinf(metrics.snr(image, image))


def test_mse_and_snr_for_known_values() -> None:
    original = np.array([[10, 20]], dtype=np.uint8)
    filtered = np.array([[20, 20]], dtype=np.uint8)

    assert metrics.mse(original, filtered) == 50.0
    expected_snr = 10 * math.log10(((10**2 + 20**2) / 2) / 50)
    assert metrics.snr(original, filtered) == pytest.approx(expected_snr)


def test_gaussian_noise_is_reproducible_with_seed() -> None:
    image = np.full((6, 6), 128, dtype=np.uint8)

    first = noise.add_gaussian_noise(image, sigma=12, rng=np.random.default_rng(42))
    second = noise.add_gaussian_noise(image, sigma=12, rng=np.random.default_rng(42))

    assert np.array_equal(first, second)
    assert first.dtype == np.uint8
    assert first.min() >= 0
    assert first.max() <= 255


def test_noise_validation() -> None:
    image = np.full((3, 3), 128, dtype=np.uint8)

    with pytest.raises(ValueError, match="sigma"):
        noise.add_gaussian_noise(image, sigma=-1)

    with pytest.raises(ValueError, match="amount"):
        noise.add_salt_and_pepper_noise(image, amount=1.1)

    assert np.array_equal(noise.add_salt_and_pepper_noise(image, amount=0), image)
