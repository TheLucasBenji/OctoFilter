import unittest

from backend.main import _remaining_iterations


class RemainingIterationsTest(unittest.TestCase):
    def test_ooa_initializing(self):
        self.assertEqual(_remaining_iterations("ooa", 0, "initializing", 50), 49)

    def test_ooa_last_loop_iteration(self):
        self.assertEqual(_remaining_iterations("ooa", 49, "iterating", 50), 0)

    def test_sfoa_first_iteration(self):
        self.assertEqual(_remaining_iterations("sfoa", 0, "iterating", 50), 49)

    def test_sfoa_last_loop_iteration(self):
        self.assertEqual(_remaining_iterations("sfoa", 49, "iterating", 50), 0)

    def test_midpoint_matches_for_both_algorithms(self):
        self.assertEqual(_remaining_iterations("ooa", 25, "iterating", 50), 24)
        self.assertEqual(_remaining_iterations("sfoa", 25, "iterating", 50), 24)

    def test_finalizing_is_zero(self):
        self.assertEqual(_remaining_iterations("ooa", 49, "finalizing", 50), 0)
        self.assertEqual(_remaining_iterations("sfoa", 49, "finalizing", 50), 0)


if __name__ == "__main__":
    unittest.main()
